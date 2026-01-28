import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import {
	FinalVote,
	Proposal,
	TopProposal,
	Settings,
	User,
} from "../../lib/models";
import { getActiveSession, registerActiveUser } from "../../lib/session-helper";
import { validateObjectId, toObjectId } from "../../lib/validation";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";
import { sendSessionResultsEmail } from "../../lib/email";
import { createLogger } from "../../lib/logger";

const log = createLogger("Votes");

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

		const { proposalId, choice, sessionId } = req.body;

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
			// Get the active session (with optional sessionId)
			const activeSession = await getActiveSession(sessionId);

			// If no active session, cannot vote
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			// Get user info to check voting rights
			const user = await User.findById(session.user.id);

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			// Check voting rights based on user type
			if (user.userType === "member") {
				// Members: 1 vote per session
				const existingVoteInSession = await FinalVote.findOne({
					sessionId: activeSession._id,
					userId: session.user.id,
				});

				if (existingVoteInSession) {
					return res.status(400).json({
						message:
							"You have already used your vote this session. Members may vote on one (1) proposal per session.",
					});
				}
			} else {
				// Citizens (and users with no specific type): 1 vote per year
				// This allows simple email-verified logins to vote
				const currentYear = new Date().getFullYear();
				const yearStart = new Date(currentYear, 0, 1);

				const votesThisYear = await FinalVote.countDocuments({
					userId: session.user.id,
					createdAt: { $gte: yearStart },
				});

				if (votesThisYear >= 1) {
					return res.status(400).json({
						message:
							"You have already used your annual vote. Citizens may vote on one (1) proposal per year.",
						votesUsed: votesThisYear,
						nextVoteDate: new Date(currentYear + 1, 0, 1).toISOString(),
					});
				}
			}

			await FinalVote.create({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				userId: session.user.id,
				choice,
			});

			// Register user as active in session
			await registerActiveUser(session.user.id, activeSession._id.toString());

			const yesCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "yes",
			});
			const noCount = await FinalVote.countDocuments({
				proposalId: toObjectId(proposalId),
				choice: "no",
			});

			// Broadcast vote update event
			await broadcaster.broadcast("vote-update", {
				proposalId: proposalId.toString(),
				yes: yesCount,
				no: noCount,
				total: yesCount + noCount,
			});

			// Re-fetch session to get latest activeUsers list
			const freshSession = await getActiveSession(activeSession._id.toString());

			// Check if session should auto-close
			const shouldClose = await checkAutoClose(freshSession);

			// If session closed, broadcast phase change
			if (shouldClose) {
				log.info("Session auto-closed after vote", { sessionId: freshSession._id.toString() });
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
			log.error("Failed to create vote", { error: error.message });
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "GET") {
		const session = await getServerSession(req, res, authOptions);
		const { proposalId, userId, checkSession, sessionId } = req.query;

		// Check if user has voted in the current session
		if (checkSession === "true" && session) {
			try {
				const activeSession = await getActiveSession(sessionId);

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
				log.error("Failed to check session vote", { error: error.message });
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
				log.error("Failed to fetch vote results", { error: error.message });
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
			return false;
		}

		// Check condition 1: All active users have voted
		// Since each user can only vote once, we check if all active users have used their vote
		const activeUserIds = activeSession.activeUsers || [];

		if (activeUserIds.length > 0) {
			// Get unique users who have voted in Phase 2
			const votedUserIds = await FinalVote.distinct("userId", {
				sessionId: activeSession._id,
			});

			// Check if all active users have voted
			const allUsersVoted = activeUserIds.every((userId) =>
				votedUserIds.some(
					(votedId) => votedId.toString() === userId.toString()
				)
			);

			if (allUsersVoted) {
				log.info("All users voted, closing session", {
					sessionId: activeSession._id.toString(),
					userCount: activeUserIds.length
				});
				await closeSession(activeSession);
				return true;
			}
		}

		// Check condition 2: Time limit exceeded (check total session time)
		if (activeSession.startDate) {
			const settings = await Settings.findOne({});
			const sessionLimitHours = settings?.sessionLimitHours || 24;

			const sessionStartTime = new Date(activeSession.startDate);
			const currentTime = new Date();
			const elapsedHours =
				(currentTime - sessionStartTime) / (1000 * 60 * 60);

			if (elapsedHours >= sessionLimitHours) {
				log.info("Session time limit exceeded, closing", {
					sessionId: activeSession._id.toString(),
					elapsedHours: elapsedHours.toFixed(1),
					limitHours: sessionLimitHours
				});
				await closeSession(activeSession);
				return true;
			}
		}

		return false;
	} catch (error) {
		log.error("Failed to check auto-close", { error: error.message });
		return false;
	}
}

// Helper function to close the session and archive proposals
async function closeSession(activeSession) {
	try {
		// Get all top proposals (status "top3") from this session
		const topProposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "top3", // Note: "top3" is the database status, but refers to top 40% of proposals
		});

		if (activeSession.singleResult) {
			// Single result mode: find all proposals with highest result (yesVotes - noVotes)
			// If there's a tie, all tied proposals share the win
			let bestResult = -Infinity;
			const proposalsWithVotes = [];

			// First pass: calculate results and find best result
			for (const proposal of topProposals) {
				const votes = await FinalVote.find({ proposalId: proposal._id });
				const yesVotes = votes.filter((v) => v.choice === "yes").length;
				const noVotes = votes.filter((v) => v.choice === "no").length;
				const result = yesVotes - noVotes;

				proposalsWithVotes.push({ proposal, yesVotes, noVotes, result });

				if (result > bestResult) {
					bestResult = result;
				}
			}

			// Second pass: save all proposals with the best result (handles ties)
			for (const item of proposalsWithVotes) {
				if (item.result === bestResult) {
					await TopProposal.create({
						sessionId: activeSession._id,
						sessionPlace:
							activeSession.place || activeSession.name || "Unknown",
						sessionStartDate:
							activeSession.startDate ||
							activeSession.createdAt ||
							new Date(),
						proposalId: item.proposal._id,
						title: item.proposal.title,
						problem: item.proposal.problem,
						solution: item.proposal.solution,
						authorName: item.proposal.authorName,
						yesVotes: item.yesVotes,
						noVotes: item.noVotes,
						archivedAt: new Date(),
					});
				}
			}
		} else {
			// Normal mode: save all proposals with yes-majority
			for (const proposal of topProposals) {
				const votes = await FinalVote.find({ proposalId: proposal._id });

				const yesVotes = votes.filter((v) => v.choice === "yes").length;
				const noVotes = votes.filter((v) => v.choice === "no").length;

				// Only save proposals with yes-majority
				if (yesVotes > noVotes) {
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
						authorName: proposal.authorName,
						yesVotes: yesVotes,
						noVotes: noVotes,
						archivedAt: new Date(),
					});
				}
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

		log.info("Session closed successfully", {
			sessionId: activeSession._id.toString(),
			sessionName: activeSession.name
		});

		// Send results email to all participants
		try {
			// Get current language setting
			const settings = await Settings.findOne();
			const language = settings?.language || "sv";

			// Get all participants from the session's activeUsers array
			const participantIds = activeSession.activeUsers || [];

			// Get user emails
			const participants = await User.find({
				_id: { $in: participantIds },
			});

			// Get top proposals that were saved (with yes-majority)
			const savedTopProposals = await TopProposal.find({
				sessionId: activeSession._id,
			});

			// Send email to each participant
			for (const user of participants) {
				try {
					await sendSessionResultsEmail(
						user.email,
						activeSession.place,
						savedTopProposals.map((tp) => ({
							title: tp.title,
							yesVotes: tp.yesVotes,
							noVotes: tp.noVotes,
						})),
						language
					);
				} catch (emailError) {
					log.error("Failed to send results email", {
						email: user.email,
						error: emailError.message
					});
				}
			}
		} catch (emailError) {
			log.error("Email sending process failed", { error: emailError.message });
			// Don't throw - we still want the session to close even if emails fail
		}
	} catch (error) {
		log.error("Failed to close session", { error: error.message });
		throw error;
	}
}
