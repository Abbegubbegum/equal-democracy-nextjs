import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import broadcaster from "@/lib/sse-broadcaster";

/**
 * Checks if a scheduled phase transition should be executed
 * Called periodically from frontend to check if 90 seconds have passed
 */
export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const now = new Date();

		// Use atomic findOneAndUpdate to claim the transition lock
		// This prevents race conditions when multiple clients try to execute simultaneously
		const activeSession = await Session.findOneAndUpdate(
			{
				status: "active",
				phase: "phase1",
				phase1TransitionScheduled: {
					$exists: true,
					$lte: now, // Only if scheduled time has passed
				},
			},
			{
				$set: { phase1TransitionScheduled: null }, // Clear immediately to prevent re-execution
			},
			{
				new: false, // Return the document BEFORE the update
			}
		);

		// If no session was found and updated, either:
		// 1. No active session exists
		// 2. Session is not in phase1
		// 3. No transition is scheduled
		// 4. Time hasn't passed yet
		// 5. Another request already claimed this transition
		if (!activeSession) {
			return res.status(200).json({ transitionExecuted: false });
		}

		// Check if time hasn't passed yet (for more detailed response)
		const scheduledTime = new Date(activeSession.phase1TransitionScheduled);
		if (now < scheduledTime) {
			// This shouldn't happen due to the query filter, but keeping for safety
			const secondsRemaining = Math.floor((scheduledTime - now) / 1000);
			return res.status(200).json({
				transitionExecuted: false,
				secondsRemaining: secondsRemaining,
			});
		}

		console.log("TRANSITION!");

		// We now have exclusive ownership of this transition - proceed with execution
		const proposalCount = await Proposal.countDocuments({
			sessionId: activeSession._id,
			status: "active",
		});

		if (proposalCount < 2) {
			return res.status(400).json({
				error: `Atleast 2 proposals are required to transition. Current count: ${proposalCount}`,
			});
		}

		// Calculate top proposals using square root curve
		// Fits: 10→4, 20→5, 100→10 (approximately)
		// Formula balances between allowing enough proposals through while preventing overwhelming choice
		const topCount = Math.max(
			2, // Minimum 2 proposals
			Math.min(
				proposalCount, // Can't exceed total proposals
				Math.round(1.2 * Math.sqrt(proposalCount))
			)
		);

		console.log("TOP COUNT");
		console.log(topCount);

		// Get proposals sorted by average rating
		const proposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "active",
		}).lean();

		// Calculate average rating for each if not already set
		for (const proposal of proposals) {
			if (!proposal.averageRating) {
				const ratings = await ThumbsUp.find({
					proposalId: proposal._id,
				});
				if (ratings.length > 0) {
					const avgRating =
						ratings.reduce((sum, r) => sum + (r.rating || 5), 0) /
						ratings.length;
					await Proposal.findByIdAndUpdate(proposal._id, {
						averageRating: avgRating,
						thumbsUpCount: ratings.length,
					});
				}
			}
		}

		// Re-fetch proposals with updated ratings
		const updatedProposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "active",
		})
			.sort({ averageRating: -1, thumbsUpCount: -1 })
			.lean();

		// Move top proposals to "top3" status
		const topProposalIds = updatedProposals
			.slice(0, topCount)
			.map((p) => p._id);

		await Proposal.updateMany(
			{ _id: { $in: topProposalIds } },
			{ status: "top3" }
		);

		// Archive the rest
		const archivedIds = updatedProposals.slice(topCount).map((p) => p._id);
		await Proposal.updateMany(
			{ _id: { $in: archivedIds } },
			{ status: "archived" }
		);

		// Update session to phase 2 and record start time
		// Note: phase1TransitionScheduled was already cleared atomically above
		activeSession.phase = "phase2";
		activeSession.phase2StartTime = new Date();
		await activeSession.save();

		// Broadcast phase change to all connected clients
		await broadcaster.broadcast("phase-change", {
			phase: "phase2",
			sessionId: activeSession._id.toString(),
			topProposalsCount: topProposalIds.length,
		});

		return res.status(200).json({
			transitionExecuted: true,
			message: "Advanced to Phase 2",
			phase: "phase2",
			topProposalsCount: topProposalIds.length,
			archivedCount: archivedIds.length,
		});
	} catch (error) {
		console.error("Error executing scheduled transition:", error);
		return res.status(500).json({ error: "Failed to execute transition" });
	}
}
