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
		});
	} catch (error) {
		console.error("Error fetching current session:", error);
		return res.status(500).json({ error: "Failed to fetch session" });
	}
}
