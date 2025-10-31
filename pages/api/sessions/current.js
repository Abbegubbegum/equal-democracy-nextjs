import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { ensureActiveSession } from "@/lib/session-helper";

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
		const activeSession = await ensureActiveSession();

		// DEBUG: Log what session we're returning
		console.log("🔍 CURRENT SESSION RETURNED:", {
			name: activeSession.name,
			status: activeSession.status,
			municipalityName: activeSession.municipalityName,
			_id: activeSession._id.toString()
		});

		// Register user as active in session (on first visit)
		// Initialize activeUsers array if it doesn't exist
		if (!activeSession.activeUsers) {
			activeSession.activeUsers = [];
		}

		// Check if user is already in activeUsers array
		const isAlreadyActive = activeSession.activeUsers.some(
			(id) => id.toString() === session.user.id
		);

		if (!isAlreadyActive) {
			// Add user to activeUsers array
			activeSession.activeUsers.push(session.user.id);
			await activeSession.save();
			console.log(`User ${session.user.name} (${session.user.id}) registered as active in session ${activeSession.name}`);
		}

		// Check if current user has marked ready for phase 1
		const userReady = activeSession.userReadyPhase1.some(
			(id) => id.toString() === session.user.id
		);

		return res.status(200).json({
			_id: activeSession._id.toString(),
			name: activeSession.name,
			municipalityName: activeSession.municipalityName,
			status: activeSession.status,
			phase: activeSession.phase,
			userReady,
			readyCount: activeSession.userReadyPhase1.length,
			activeUsersCount: activeSession.activeUsers?.length || 0,
			// Debug info - remove later
			debug: {
				currentUserId: session.user.id,
				isActiveUser: isAlreadyActive,
			}
		});
	} catch (error) {
		console.error("Error fetching current session:", error);
		return res.status(500).json({ error: "Failed to fetch session" });
	}
}
