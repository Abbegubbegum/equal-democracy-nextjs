import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { FinalVote, Session, Proposal, TopProposal, Settings } from "../../lib/models";
import { ensureActiveSession } from "../../lib/session-helper";
import { validateObjectId, toObjectId } from "../../lib/validation";
import { csrfProtection } from "../../lib/csrf";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId, choice } = req.body;

		if (!proposalId || !choice) {
			return res
				.status(400)
				.json({ message: "Proposal ID och val krävs" });
		}

		if (!validateObjectId(proposalId)) {
			return res.status(400).json({ message: "Invalid proposal ID format" });
		}

		if (!["yes", "no"].includes(choice)) {
			return res
				.status(400)
				.json({ message: 'Val måste vara "yes" eller "no"' });
		}

		try {
			// Get the active session
			const activeSession = await ensureActiveSession();

			const existingVote = await FinalVote.findOne({
				proposalId: toObjectId(proposalId),
				userId: session.user.id,
			});

			if (existingVote) {
				return res
					.status(400)
					.json({ message: "Du har redan röstat på detta förslag" });
			}

			await FinalVote.create({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				userId: session.user.id,
				choice,
			});

			const yesCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "yes",
			});
			const noCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "no",
			});

			// Check if session should auto-close
			const shouldClose = await checkAutoClose(activeSession);

			return res.status(201).json({
				message: "Röst registrerad",
				results: {
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
				},
				sessionClosed: shouldClose,
			});
		} catch (error) {
			console.error("Error creating vote:", error);
			return res.status(500).json({ message: "Ett fel uppstod" });
		}
	}

	if (req.method === "GET") {
		const { proposalId, userId } = req.query;

		if (proposalId) {
			if (!validateObjectId(proposalId)) {
				return res.status(400).json({ message: "Invalid proposal ID format" });
			}

			if (userId && !validateObjectId(userId)) {
				return res.status(400).json({ message: "Invalid user ID format" });
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
				return res.status(500).json({ message: "Ett fel uppstod" });
			}
		}

		return res.status(400).json({ message: "Proposal ID krävs" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}

// Helper function to check if session should auto-close
async function checkAutoClose(activeSession) {
	try {
		// Only check in phase 2
		if (activeSession.phase !== "phase2") {
			return false;
		}

		// Check condition 1: All users who participated in Phase 1 have voted
		const phase1UserIds = activeSession.userReadyPhase1 || [];

		if (phase1UserIds.length > 0) {
			// Get unique users who have voted in Phase 2
			const votedUserIds = await FinalVote.distinct("userId", {
				sessionId: activeSession._id,
			});

			// Check if all phase1 users have voted
			const allUsersVoted = phase1UserIds.every((userId) =>
				votedUserIds.some(
					(votedId) => votedId.toString() === userId.toString()
				)
			);

			if (allUsersVoted) {
				await closeSession(activeSession);
				return true;
			}
		}

		// Check condition 2: Time limit exceeded
		if (activeSession.phase2StartTime) {
			const settings = await Settings.findOne({});
			const durationHours = settings?.phase2DurationHours || 6;

			const phase2StartTime = new Date(activeSession.phase2StartTime);
			const currentTime = new Date();
			const elapsedHours = (currentTime - phase2StartTime) / (1000 * 60 * 60);

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
		// Get all top3 proposals from this session
		const top3Proposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "top3",
		});

		// For each top3 proposal, calculate votes and save if yes-majority
		for (const proposal of top3Proposals) {
			const votes = await FinalVote.find({ proposalId: proposal._id });

			const yesVotes = votes.filter((v) => v.choice === "yes").length;
			const noVotes = votes.filter((v) => v.choice === "no").length;

			// Only save proposals with yes-majority
			if (yesVotes > noVotes) {
				await TopProposal.create({
					sessionId: activeSession._id,
					sessionName: activeSession.name,
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

		console.log(`Session ${activeSession.name} auto-closed`);
	} catch (error) {
		console.error("Error closing session:", error);
		throw error;
	}
}
