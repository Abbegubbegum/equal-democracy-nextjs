import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

/**
 * Checks if a scheduled phase transition should be executed
 * Called periodically from frontend to check if 100 seconds have passed
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
		// Get active session
		const activeSession = await Session.findOne({ status: "active" });

		if (!activeSession || activeSession.phase !== "phase1") {
			return res.status(200).json({ transitionExecuted: false });
		}

		// Check if transition is scheduled and time has passed
		if (!activeSession.phase1TransitionScheduled) {
			return res.status(200).json({ transitionExecuted: false });
		}

		const scheduledTime = new Date(activeSession.phase1TransitionScheduled);
		const now = new Date();

		if (now < scheduledTime) {
			// Not time yet
			const secondsRemaining = Math.floor((scheduledTime - now) / 1000);
			return res.status(200).json({
				transitionExecuted: false,
				secondsRemaining: secondsRemaining,
			});
		}

		// Time to execute transition!
		const proposalCount = await Proposal.countDocuments({
			sessionId: activeSession._id,
			status: "active",
		});

		if (proposalCount < 2) {
			return res.status(400).json({
				error: `Minst 2 förslag krävs för att starta fas 2. Nuvarande antal: ${proposalCount}`,
			});
		}

		// Calculate top proposals (min of: all proposals, max(2, 40% of proposals))
		const topCount = Math.min(
			proposalCount,
			Math.max(2, Math.ceil(proposalCount * 0.4))
		);

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
		const topProposalIds = updatedProposals.slice(0, topCount).map((p) => p._id);

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
		activeSession.phase = "phase2";
		activeSession.phase2StartTime = new Date();
		activeSession.phase1TransitionScheduled = null; // Clear the scheduled time
		await activeSession.save();

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
