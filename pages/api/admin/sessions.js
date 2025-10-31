import dbConnect from "@/lib/mongodb";
import { Session, Settings } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import broadcaster from "@/lib/sse-broadcaster";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user is admin
	const session = await getServerSession(req, res, authOptions);
	if (!session || !session.user?.isAdmin) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			// Get all sessions
			const sessions = await Session.find().sort({ createdAt: -1 });
			return res.status(200).json(sessions);
		} catch (error) {
			console.error("Error fetching sessions:", error);
			return res.status(500).json({ error: "Failed to fetch sessions" });
		}
	}

	if (req.method === "POST") {
		try {
			const { name, municipalityName } = req.body;

			if (!name || !municipalityName) {
				return res.status(400).json({ error: "Name and municipality name are required" });
			}

			// Check if there's already an active session
			const activeSession = await Session.findOne({ status: "active" });
			if (activeSession) {
				return res.status(400).json({
					error: "There is already an active session. Please close it before creating a new one."
				});
			}

			// Create new session
			const newSession = await Session.create({
				name: name.trim(),
				municipalityName: municipalityName.trim(),
				status: "active",
				startDate: new Date(),
			});

			// Broadcast new session event to all connected clients
			broadcaster.broadcast("new-session", {
				_id: newSession._id.toString(),
				name: newSession.name,
				municipalityName: newSession.municipalityName,
				status: newSession.status,
				phase: newSession.phase,
				startDate: newSession.startDate,
			});

			return res.status(201).json(newSession);
		} catch (error) {
			console.error("Error creating session:", error);
			if (error.code === 11000) {
				return res.status(400).json({ error: "A session with this name already exists" });
			}
			return res.status(500).json({ error: "Failed to create session" });
		}
	}

	if (req.method === "PATCH") {
		try {
			const { id, updates } = req.body;

			if (!id) {
				return res.status(400).json({ error: "Session ID is required" });
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
