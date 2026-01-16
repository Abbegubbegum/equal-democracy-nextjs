import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import broadcaster from "@/lib/sse-broadcaster";

/**
 * Archives a ranking session manually
 * POST /api/admin/archive-session
 */
export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	// Check if user is admin
	if (!session.user.isAdmin && !session.user.isSuperAdmin) {
		return res.status(403).json({ error: "Forbidden - Admin access required" });
	}

	try {
		const { sessionId } = req.body;

		if (!sessionId) {
			return res.status(400).json({ error: "Session ID required" });
		}

		// Find the session
		const surveySession = await Session.findById(sessionId);

		if (!surveySession) {
			return res.status(404).json({ error: "Session not found" });
		}

		// Only allow archiving ranking sessions
		if (surveySession.sessionType !== "survey") {
			return res.status(400).json({ error: "Only ranking sessions can be archived. Use close-session for standard sessions." });
		}

		// Check if already archived
		if (surveySession.status === "archived") {
			return res.status(400).json({ error: "Session is already archived" });
		}

		// Check if user has permission (super admin or creator)
		if (!session.user.isSuperAdmin) {
			const creatorId = surveySession.createdBy?.toString();
			if (creatorId !== session.user.id) {
				return res.status(403).json({ error: "You can only archive sessions you created" });
			}
		}

		// Archive the session
		surveySession.status = "archived";
		surveySession.endDate = new Date();
		await surveySession.save();

		// Broadcast session archived event
		await broadcaster.broadcast("session-archived", {
			sessionId: surveySession._id.toString(),
			place: surveySession.place,
		});

		return res.status(200).json({
			success: true,
			message: "Ranking session archived successfully",
			sessionId: surveySession._id,
		});
	} catch (error) {
		console.error("Error archiving session:", error);
		return res.status(500).json({ error: "Failed to archive session" });
	}
}
