import dbConnect from "@/lib/mongodb";
import { Session, Settings, User, FinalVote } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import broadcaster from "@/lib/sse-broadcaster";
import {
	hasAdminAccess,
	isSuperAdmin,
	checkAdminSessionLimit,
} from "@/lib/admin-helper";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user has admin access
	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			// Superadmins see all sessions, regular admins see only their own
			const filter = isSuperAdmin(session.user)
				? {}
				: { createdBy: session.user.id };

			// Get sessions based on filter and populate creator info
			const sessions = await Session.find(filter)
				.populate("createdBy", "name email")
				.sort({ createdAt: -1 })
				.lean();

			// For active sessions, populate active users with voting status
			for (const sess of sessions) {
				if (
					sess.status === "active" &&
					sess.activeUsers &&
					sess.activeUsers.length > 0
				) {
					// Get user details
					const users = await User.find({
						_id: { $in: sess.activeUsers },
					})
						.select("name email")
						.lean();

					// If in phase2, check voting status
					if (sess.phase === "phase2") {
						// Get all final votes for this session
						const votes = await FinalVote.find({
							sessionId: sess._id,
						})
							.select("userId")
							.lean();

						// Create a set of user IDs who have voted
						const votedUserIds = new Set(
							votes.map((vote) => vote.userId.toString())
						);

						// Add voting status to users
						sess.activeUsersWithStatus = users.map((user) => ({
							_id: user._id,
							name: user.name,
							email: user.email,
							hasVoted: votedUserIds.has(user._id.toString()),
						}));
					} else {
						// Phase 1 - just show users
						sess.activeUsersWithStatus = users.map((user) => ({
							_id: user._id,
							name: user.name,
							email: user.email,
						}));
					}
				}
			}

			return res.status(200).json(sessions);
		} catch (error) {
			console.error("Error fetching sessions:", error);
			return res.status(500).json({ error: "Failed to fetch sessions" });
		}
	}

	if (req.method === "POST") {
		try {
			const { place, maxOneProposalPerUser, showUserCount, noMotivation } = req.body;

			if (!place) {
				return res.status(400).json({ error: "Place is required" });
			}

			// Check session limits for regular admins
			const limitCheck = await checkAdminSessionLimit(session.user.id);
			if (!limitCheck.canCreate) {
				return res.status(400).json({
					error: limitCheck.message,
					remaining: limitCheck.remaining,
					total: limitCheck.total,
				});
			}

			// Check if there's already an active session
			const activeSession = await Session.findOne({ status: "active" });
			if (activeSession) {
				return res.status(400).json({
					error: "There is already an active session. Please close it before creating a new one.",
				});
			}

			// Create new session
			const newSession = await Session.create({
				place: place.trim(),
				status: "active",
				startDate: new Date(),
				createdBy: session.user.id,
				maxOneProposalPerUser: maxOneProposalPerUser || false,
				showUserCount: showUserCount !== undefined ? showUserCount : false,
				noMotivation: noMotivation !== undefined ? noMotivation : false,
			});

			// Decrement remainingSessions for regular admins (not superadmins)
			const user = await User.findById(session.user.id);
			let isLastSession = false;
			if (
				user &&
				user.isAdmin &&
				!user.isSuperAdmin &&
				user.remainingSessions > 0
			) {
				user.remainingSessions -= 1;
				isLastSession = user.remainingSessions === 0;
				await user.save();
			}

			// Broadcast new session event to all connected clients
			await broadcaster.broadcast("new-session", {
				_id: newSession._id.toString(),
				place: newSession.place,
				status: newSession.status,
				phase: newSession.phase,
				startDate: newSession.startDate,
			});

			return res.status(201).json({
				...newSession.toObject(),
				isLastSession,
				remainingSessions: user?.remainingSessions || 0,
			});
		} catch (error) {
			console.error("Error creating session:", error);
			if (error.code === 11000) {
				return res
					.status(400)
					.json({ error: "A session with this name already exists" });
			}
			return res.status(500).json({ error: "Failed to create session" });
		}
	}

	if (req.method === "PATCH") {
		try {
			const { id, updates } = req.body;

			if (!id) {
				return res
					.status(400)
					.json({ error: "Session ID is required" });
			}

			const updatedSession = await Session.findByIdAndUpdate(
				id,
				updates,
				{ new: true, runValidators: true }
			);

			if (!updatedSession) {
				return res.status(404).json({ error: "Session not found" });
			}

			return res.status(200).json(updatedSession);
		} catch (error) {
			console.error("Error updating session:", error);
			return res.status(500).json({ error: "Failed to update session" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
