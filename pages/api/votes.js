import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import {
	FinalVote,
	Session,
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
			} else if (user.userType === "citizen") {
				// Citizens: 1 vote per year
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
			} else {
				// User must be registered as member or citizen to vote
				return res.status(403).json({
					message:
						"You must be registered as a member or citizen to vote. Please complete your profile.",
				});
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
				console.log(
					`[AUTO-CLOSE] ✅ All ${activeUserIds.length} users have voted! Closing session...`
				);
				await closeSession(activeSession);
				return true;
			} else {
			}
		} else {
			console.log(
				`[AUTO-CLOSE] ⚠️ No active users registered in session!`
			);
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
				console.log(
					`[AUTO-CLOSE] ⏰ Session time limit exceeded (${elapsedHours.toFixed(1)}h / ${sessionLimitHours}h). Closing session...`
				);
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

		console.log(
			`[CLOSE-SESSION] ✅ Session ${activeSession.name} successfully closed and saved!`
		);

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
			let successCount = 0;
			let errorCount = 0;

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
					successCount++;
				} catch (emailError) {
					console.error(
						`[CLOSE-SESSION] ✗ Failed to send email to ${user.email}:`,
						emailError
					);
					errorCount++;
				}
			}
		} catch (emailError) {
			console.error(
				"[CLOSE-SESSION] Error during email sending process:",
				emailError
			);
			// Don't throw - we still want the session to close even if emails fail
		}
	} catch (error) {
		console.error("Error closing session:", error);
		throw error;
	}
}
