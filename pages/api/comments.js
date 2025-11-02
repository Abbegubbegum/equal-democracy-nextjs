import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { Comment } from "../../lib/models";
import { getActiveSession, registerActiveUser } from "../../lib/session-helper";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "GET") {
		const { proposalId } = req.query;

		if (!proposalId) {
			return res.status(400).json({ message: "Proposal ID is required" });
		}

		try {
			const comments = await Comment.find({ proposalId })
				.sort({ averageRating: -1, createdAt: -1 }) // Sort by rating first, then by creation date
				.lean();

			// Return comments with anonymized data and type
			const anonymizedComments = comments.map((comment) => ({
				_id: comment._id.toString(),
				proposalId: comment.proposalId.toString(),
				authorName: comment.authorName, // This is the anonymous display name
				text: comment.text,
				type: comment.type || "neutral",
				averageRating: comment.averageRating || 0,
				createdAt: comment.createdAt,
			}));

			return res.status(200).json(anonymizedComments);
		} catch (error) {
			console.error("Error fetching comments:", error);
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { proposalId, text, type } = req.body;

		if (!proposalId || !text) {
			return res
				.status(400)
				.json({ message: "Proposal ID and text is required" });
		}

		if (text.length > 1000) {
			return res
				.status(400)
				.json({ message: "Comment is too long (max 1000 characters)" });
		}

		// Validate type
		if (type && !["for", "against", "neutral"].includes(type)) {
			return res.status(400).json({ message: "Invalid comment type" });
		}

		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, cannot create comment
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			const comment = await Comment.create({
				sessionId: activeSession._id,
				proposalId,
				userId: session.user.id,
				authorName: session.user.name,
				text,
				type: type || "neutral",
			});

			// Register user as active in session
			await registerActiveUser(session.user.id);

			// Broadcast new comment event
			await broadcaster.broadcast("new-comment", {
				_id: comment._id.toString(),
				proposalId: comment.proposalId.toString(),
				authorName: comment.authorName,
				text: comment.text,
				type: comment.type,
				averageRating: comment.averageRating || 0,
				createdAt: comment.createdAt,
			});

			return res.status(201).json({
				_id: comment._id.toString(),
				proposalId: comment.proposalId.toString(),
				authorName: comment.authorName,
				text: comment.text,
				type: comment.type,
				averageRating: comment.averageRating || 0,
				createdAt: comment.createdAt,
			});
		} catch (error) {
			console.error("Error creating comment:", error);
			return res
				.status(500)
				.json({ message: "An error occurred while creating comments" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
