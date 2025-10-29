import dbConnect from "@/lib/mongodb";
import { Session, FinalVote, Settings } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		// Get active session
		const activeSession = await Session.findOne({ status: "active" });

		if (!activeSession) {
			return res.status(404).json({ error: "No active session found" });
		}

		// Only check auto-close in phase 2
		if (activeSession.phase !== "phase2") {
			return res.status(200).json({
				shouldClose: false,
				reason: "Not in phase 2",
			});
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
				votedUserIds.some((votedId) => votedId.toString() === userId.toString())
			);

			if (allUsersVoted) {
				return res.status(200).json({
					shouldClose: true,
					reason: "all_users_voted",
					message: "Alla deltagare har röstat",
				});
			}
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
				return res.status(200).json({
					shouldClose: true,
					reason: "time_limit_exceeded",
					message: `Tidsgränsen på ${durationHours} timmar har nåtts`,
				});
			}

			// Return time remaining
			const hoursRemaining = durationHours - elapsedHours;
			return res.status(200).json({
				shouldClose: false,
				reason: "time_remaining",
				hoursRemaining: Math.max(0, hoursRemaining),
				votedCount: phase1UserIds.length > 0 ? await FinalVote.distinct("userId", {
					sessionId: activeSession._id,
				}).then(ids => ids.length) : 0,
				totalUsers: phase1UserIds.length,
			});
		}

		return res.status(200).json({
			shouldClose: false,
			reason: "phase2_start_time_missing",
		});
	} catch (error) {
		console.error("Error checking auto-close:", error);
		return res.status(500).json({ error: "Failed to check auto-close" });
	}
}
