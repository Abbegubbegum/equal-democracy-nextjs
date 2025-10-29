import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Get active session
		const activeSession = await Session.findOne({ status: "active" });

		if (!activeSession) {
			return res.status(404).json({ error: "No active session found" });
		}

		// Check if user already marked ready
		const userId = session.user.id;
		const alreadyReady = activeSession.userReadyPhase1.some(
			(id) => id.toString() === userId
		);

		if (alreadyReady) {
			return res.status(400).json({ error: "Already marked as ready" });
		}

		// Add user to ready list
		activeSession.userReadyPhase1.push(userId);
		await activeSession.save();

		return res.status(200).json({
			message: "Marked as ready",
			readyCount: activeSession.userReadyPhase1.length,
		});
	} catch (error) {
		console.error("Error marking user as ready:", error);
		return res.status(500).json({ error: "Failed to mark as ready" });
	}
}
