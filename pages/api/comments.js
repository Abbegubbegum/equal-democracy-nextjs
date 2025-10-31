import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { Comment } from "../../lib/models";
import { getActiveSession } from "../../lib/session-helper";
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
			return res.status(400).json({ message: "Proposal ID krävs" });
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
			return res.status(500).json({ message: "Ett fel uppstod" });
		}
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId, text, type } = req.body;

		if (!proposalId || !text) {
			return res
				.status(400)
				.json({ message: "Proposal ID och text krävs" });
		}

		if (text.length > 1000) {
			return res
				.status(400)
				.json({ message: "Kommentaren är för lång (max 1000 tecken)" });
		}

		// Validate type
		if (type && !["for", "against", "neutral"].includes(type)) {
			return res.status(400).json({ message: "Ogiltig kommentarstyp" });
		}

		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, cannot create comment
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "Ingen aktiv session finns" });
			}

			const comment = await Comment.create({
				sessionId: activeSession._id,
				proposalId,
				userId: session.user.id,
				authorName: session.user.name,
				text,
				type: type || "neutral",
			});

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
				.json({ message: "Ett fel uppstod vid skapande av kommentar" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
