import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Comment, CommentRating } from "../../../lib/models";
import { getActiveSession } from "../../../lib/session-helper";
import { csrfProtection } from "../../../lib/csrf";
import broadcaster from "../../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You have to be logged in" });
	}

	if (req.method === "POST") {
		const { commentId, rating } = req.body;

		if (!commentId || !rating) {
			return res
				.status(400)
				.json({ message: "Comment ID and rating is required" });
		}

		// Validate rating
		if (typeof rating !== "number" || rating < 1 || rating > 5) {
			return res
				.status(400)
				.json({ message: "Rating must be a number between 1 and 5" });
		}

		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, cannot rate
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			// Check if comment exists
			const comment = await Comment.findById(commentId);
			if (!comment) {
				return res.status(404).json({ message: "Comment not found" });
			}

			// Check if user has already rated this comment
			const existingRating = await CommentRating.findOne({
				commentId,
				userId: session.user.id,
			});

			if (existingRating) {
				// Update existing rating
				existingRating.rating = rating;
				await existingRating.save();
			} else {
				// Create new rating
				await CommentRating.create({
					sessionId: activeSession._id,
					commentId,
					userId: session.user.id,
					rating,
				});
			}

			// Calculate new average rating
			const ratings = await CommentRating.find({ commentId });
			const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
			const averageRating = ratings.length > 0 ? sum / ratings.length : 0;

			// Update comment with new average
			comment.averageRating = averageRating;
			await comment.save();

			// Broadcast comment rating update to all connected clients
			await broadcaster.broadcast("comment-rating-update", {
				commentId: commentId.toString(),
				proposalId: comment.proposalId.toString(),
				averageRating: averageRating,
				totalRatings: ratings.length,
			});

			return res.status(200).json({
				success: true,
				averageRating,
				userRating: rating,
				totalRatings: ratings.length,
			});
		} catch (error) {
			console.error("Error rating comment:", error);
			return res.status(500).json({
				message: "An error occurred with rating comments",
			});
		}
	}

	if (req.method === "GET") {
		const { commentId } = req.query;

		if (!commentId) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		try {
			// Get user's rating for this comment
			const rating = await CommentRating.findOne({
				commentId,
				userId: session.user.id,
			});

			return res.status(200).json({
				userRating: rating ? rating.rating : 0,
			});
		} catch (error) {
			console.error("Error fetching comment rating:", error);
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
