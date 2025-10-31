import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { ThumbsUp, Proposal, Session } from "../../lib/models";
import { ensureActiveSession } from "../../lib/session-helper";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId, rating } = req.body;

		if (!proposalId) {
			return res.status(400).json({ message: "Proposal ID krävs" });
		}

		// Validate rating (1-5)
		if (rating && (rating < 1 || rating > 5)) {
			return res.status(400).json({ message: "Betyg måste vara mellan 1 och 5" });
		}

		try {
			// Get the active session
			const activeSession = await ensureActiveSession();

			// If no active session, cannot rate
			if (!activeSession) {
				return res.status(400).json({ message: "Ingen aktiv session finns" });
			}

			const existingVote = await ThumbsUp.findOne({
				proposalId,
				userId: session.user.id,
			});

			if (existingVote) {
				// Update existing rating
				existingVote.rating = rating || 5;
				await existingVote.save();

				// Recalculate average rating
				const ratings = await ThumbsUp.find({ proposalId });
				const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
				const count = ratings.length;

				await Proposal.findByIdAndUpdate(proposalId, {
					thumbsUpCount: count,
					averageRating: avgRating,
				});

				// Broadcast rating update event
				broadcaster.broadcast('rating-update', {
					proposalId: proposalId.toString(),
					thumbsUpCount: count,
					averageRating: avgRating,
				});

				return res.status(200).json({
					message: "Betyg uppdaterat",
					count,
					averageRating: avgRating,
					userRating: existingVote.rating
				});
			}

			// Create new rating
			await ThumbsUp.create({
				sessionId: activeSession._id,
				proposalId,
				userId: session.user.id,
				rating: rating || 5,
			});

			// Calculate average rating
			const ratings = await ThumbsUp.find({ proposalId });
			const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
			const count = ratings.length;

			await Proposal.findByIdAndUpdate(proposalId, {
				thumbsUpCount: count,
				averageRating: avgRating,
			});

			// Broadcast rating update event
			broadcaster.broadcast('rating-update', {
				proposalId: proposalId.toString(),
				thumbsUpCount: count,
				averageRating: avgRating,
			});

			return res.status(201).json({
				message: "Betyg registrerat",
				count,
				averageRating: avgRating,
				userRating: rating || 5
			});
		} catch (error) {
			console.error("Error adding thumbs up:", error);
			return res.status(500).json({ message: "Ett fel uppstod" });
		}
	}

	if (req.method === "GET") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId } = req.query;

		if (proposalId) {
			const voted = await ThumbsUp.exists({
				proposalId,
				userId: session.user.id,
			});

			return res.status(200).json({ voted: !!voted });
		}

		const votes = await ThumbsUp.find({ userId: session.user.id })
			.populate("proposalId")
			.lean();

		return res.status(200).json(votes);
	}

	return res.status(405).json({ message: "Method not allowed" });
}
