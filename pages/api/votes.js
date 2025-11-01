import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import {
	FinalVote,
	Session,
	Proposal,
	TopProposal,
	Settings,
} from "../../lib/models";
import { getActiveSession } from "../../lib/session-helper";
import { validateObjectId, toObjectId } from "../../lib/validation";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { proposalId, choice } = req.body;

		if (!proposalId || !choice) {
			return res
				.status(400)
				.json({ message: "Proposal ID and choice is required" });
		}

		if (!validateObjectId(proposalId)) {
			return res
				.status(400)
				.json({ message: "Invalid proposal ID format" });
		}

		if (!["yes", "no"].includes(choice)) {
			return res
				.status(400)
				.json({ message: 'Choice needs to be "yes" or "no"' });
		}

		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, cannot vote
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			// Check if user has already voted in this session (limit: 1 vote per session)
			const existingVoteInSession = await FinalVote.findOne({
				sessionId: activeSession._id,
				userId: session.user.id,
			});

			if (existingVoteInSession) {
				return res.status(400).json({
					message:
						"You have already used your vote this session. Each user may only vote on one (1) proposal.",
				});
			}

			console.log(
				`[VOTE] User ${session.user.name} (${session.user.id}) voting ${choice} on proposal ${proposalId}`
			);

			await FinalVote.create({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				userId: session.user.id,
				choice,
			});

			console.log(`[VOTE] ✓ Vote saved successfully`);

			const yesCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "yes",
			});
			const noCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "no",
			});

			console.log(
				`[VOTE] Current vote counts for proposal: YES=${yesCount}, NO=${noCount}`
			);

			// Broadcast vote update event
			await broadcaster.broadcast("vote-update", {
				proposalId: proposalId.toString(),
				yes: yesCount,
				no: noCount,
				total: yesCount + noCount,
			});

			// Re-fetch session to get latest activeUsers list
			const freshSession = await getActiveSession();

			// Check if session should auto-close
			const shouldClose = await checkAutoClose(freshSession);

			// If session closed, broadcast phase change
			if (shouldClose) {
				console.log(
					"[VOTE] 🎉 Session closed! Broadcasting phase-change event..."
				);
				await broadcaster.broadcast("phase-change", {
					phase: "closed",
					sessionId: freshSession._id.toString(),
				});
			}

			return res.status(201).json({
				message: "Vote registered",
				results: {
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
				},
				sessionClosed: shouldClose,
			});
		} catch (error) {
			console.error("Error creating vote:", error);
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "GET") {
		const session = await getServerSession(req, res, authOptions);
		const { proposalId, userId, checkSession } = req.query;

		// Check if user has voted in the current session
		if (checkSession === "true" && session) {
			try {
				const activeSession = await getActiveSession();

				// If no active session, cannot vote
				if (!activeSession) {
					return res
						.status(400)
						.json({ message: "No active session exists" });
				}

				const userVote = await FinalVote.findOne({
					sessionId: activeSession._id,
					userId: session.user.id,
				}).populate("proposalId");

				return res.status(200).json({
					hasVotedInSession: !!userVote,
					votedProposalId:
						userVote?.proposalId?._id?.toString() || null,
					votedProposalTitle: userVote?.proposalId?.title || null,
				});
			} catch (error) {
				console.error("Error checking session vote:", error);
				return res
					.status(500)
					.json({ message: "An error has occured" });
			}
		}

		if (proposalId) {
			if (!validateObjectId(proposalId)) {
				return res
					.status(400)
					.json({ message: "Invalid proposal ID format" });
			}

			if (userId && !validateObjectId(userId)) {
				return res
					.status(400)
					.json({ message: "Invalid user ID format" });
			}

			try {
				const yesCount = await FinalVote.countDocuments({
					proposalId: toObjectId(proposalId),
					choice: "yes",
				});
				const noCount = await FinalVote.countDocuments({
					proposalId: toObjectId(proposalId),
					choice: "no",
				});

				let hasVoted = false;
				if (userId) {
					hasVoted = await FinalVote.exists({
						proposalId: toObjectId(proposalId),
						userId: toObjectId(userId),
					});
				}

				return res.status(200).json({
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
					hasVoted: !!hasVoted,
				});
			} catch (error) {
				console.error("Error fetching vote results:", error);
				return res
					.status(500)
					.json({ message: "An error has occured" });
			}
		}

		return res.status(400).json({ message: "Proposal ID is required" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}

// Helper function to check if session should auto-close
async function checkAutoClose(activeSession) {
	try {
		// Only check in phase 2
		if (activeSession.phase !== "phase2") {
			console.log(
				`[AUTO-CLOSE] Not in phase2, current phase: ${activeSession.phase}`
			);
			return false;
		}

		// Check condition 1: All active users have voted
		// Since each user can only vote once, we check if all active users have used their vote
		const activeUserIds = activeSession.activeUsers || [];

		console.log(`[AUTO-CLOSE] Active users count: ${activeUserIds.length}`);
		console.log(
			`[AUTO-CLOSE] Active users:`,
			activeUserIds.map((id) => id.toString())
		);

		if (activeUserIds.length > 0) {
			// Get unique users who have voted in Phase 2
			const votedUserIds = await FinalVote.distinct("userId", {
				sessionId: activeSession._id,
			});

			console.log(
				`[AUTO-CLOSE] Voted users count: ${votedUserIds.length}`
			);
			console.log(
				`[AUTO-CLOSE] Voted users:`,
				votedUserIds.map((id) => id.toString())
			);

			// Check if all active users have voted
			const allUsersVoted = activeUserIds.every((userId) =>
				votedUserIds.some(
					(votedId) => votedId.toString() === userId.toString()
				)
			);

			console.log(`[AUTO-CLOSE] All users voted: ${allUsersVoted}`);

			if (allUsersVoted) {
				console.log(
					`[AUTO-CLOSE] ✅ All ${activeUserIds.length} users have voted! Closing session...`
				);
				await closeSession(activeSession);
				return true;
			} else {
				console.log(
					`[AUTO-CLOSE] ⏳ Waiting for more votes. ${votedUserIds.length}/${activeUserIds.length} users have voted.`
				);
			}
		} else {
			console.log(
				`[AUTO-CLOSE] ⚠️ No active users registered in session!`
			);
		}

		// Check condition 2: Time limit exceeded
		if (activeSession.phase2StartTime) {
			const settings = await Settings.findOne({});
			const durationHours = settings?.phase2DurationHours || 6;

			const phase2StartTime = new Date(activeSession.phase2StartTime);
			const currentTime = new Date();
			const elapsedHours =
				(currentTime - phase2StartTime) / (1000 * 60 * 60);

			if (elapsedHours >= durationHours) {
				await closeSession(activeSession);
				return true;
			}
		}

		return false;
	} catch (error) {
		console.error("Error checking auto-close:", error);
		return false;
	}
}

// Helper function to close the session and archive proposals
async function closeSession(activeSession) {
	try {
		console.log(
			`[CLOSE-SESSION] 🚀 Starting to close session: ${activeSession.name}`
		);

		// Get all top proposals (status "top3") from this session
		const topProposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "top3", // Note: "top3" is the database status, but refers to top 40% of proposals
		});

		console.log(
			`[CLOSE-SESSION] Found ${topProposals.length} top proposals in session ${activeSession.name}`
		);

		// For each top proposal, calculate votes and save if yes-majority
		for (const proposal of topProposals) {
			const votes = await FinalVote.find({ proposalId: proposal._id });

			const yesVotes = votes.filter((v) => v.choice === "yes").length;
			const noVotes = votes.filter((v) => v.choice === "no").length;

			console.log(
				`Proposal "${proposal.title}": ${yesVotes} yes, ${noVotes} no votes`
			);

			// Only save proposals with yes-majority
			if (yesVotes > noVotes) {
				console.log(
					`✓ Saving "${proposal.title}" as winning proposal (${yesVotes} > ${noVotes})`
				);
				await TopProposal.create({
					sessionId: activeSession._id,
					sessionPlace:
						activeSession.place || activeSession.name || "Unknown",
					sessionStartDate:
						activeSession.startDate ||
						activeSession.createdAt ||
						new Date(),
					proposalId: proposal._id,
					title: proposal.title,
					problem: proposal.problem,
					solution: proposal.solution,
					estimatedCost: proposal.estimatedCost,
					authorName: proposal.authorName,
					yesVotes: yesVotes,
					noVotes: noVotes,
					archivedAt: new Date(),
				});
			} else {
				console.log(
					`✗ Skipping "${proposal.title}" (${yesVotes} ≤ ${noVotes})`
				);
			}
		}

		// Archive all proposals in this session
		await Proposal.updateMany(
			{ sessionId: activeSession._id },
			{ status: "archived" }
		);

		// Close the session
		activeSession.status = "closed";
		activeSession.phase = "closed";
		activeSession.endDate = new Date();
		await activeSession.save();

		console.log(
			`[CLOSE-SESSION] ✅ Session ${activeSession.name} successfully closed and saved!`
		);
	} catch (error) {
		console.error("Error closing session:", error);
		throw error;
	}
}
