import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getActiveSession } from "@/lib/session-helper";

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
		const activeSession = await getActiveSession();

		// If no active session exists, return null
		if (!activeSession) {
			return res.status(200).json({
				noActiveSession: true,
				phase: null,
				status: null,
			});
		}

		// Users are now only registered as active when they perform actions
		// (create proposal, rate, vote, comment) via registerActiveUser() helper

		return res.status(200).json({
			_id: activeSession._id.toString(),
			place: activeSession.place,
			status: activeSession.status,
			phase: activeSession.phase,
			activeUsersCount: activeSession.activeUsers?.length || 0,
			showUserCount: activeSession.showUserCount !== undefined ? activeSession.showUserCount : false,
			noMotivation: activeSession.noMotivation !== undefined ? activeSession.noMotivation : false,
		});
	} catch (error) {
		console.error("Error fetching current session:", error);
		return res.status(500).json({ error: "Failed to fetch session" });
	}
}
