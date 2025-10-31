import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Proposal, ThumbsUp, Comment } from "../../../lib/models";
import { getActiveSession } from "../../../lib/session-helper";
import { csrfProtection } from "../../../lib/csrf";
import broadcaster from "../../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "GET") {
		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, return empty array
			if (!activeSession) {
				return res.status(200).json([]);
			}

			// Only get proposals from the active session
			const proposals = await Proposal.find({
				sessionId: activeSession._id,
			})
				.sort({ createdAt: -1 })
				.lean();

			const proposalsWithCounts = await Promise.all(
				proposals.map(async (proposal) => {
					const thumbsUpCount = await ThumbsUp.countDocuments({
						proposalId: proposal._id,
					});
					const commentsCount = await Comment.countDocuments({
						proposalId: proposal._id,
					});

					return {
						...proposal,
						_id: proposal._id.toString(),
						authorId: proposal.authorId.toString(),
						thumbsUpCount,
						commentsCount,
					};
				})
			);

			return res.status(200).json(proposalsWithCounts);
		} catch (error) {
			console.error("Error fetching proposals:", error);
			return res.status(500).json({ message: "Ett fel uppstod" });
		}
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { title, problem, solution, estimatedCost } = req.body;

		if (!title || !problem || !solution || !estimatedCost) {
			return res.status(400).json({ message: "Alla fält krävs" });
		}

		try {
			// Get the active session
			const activeSession = await getActiveSession();

			// If no active session, cannot create proposal
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "Ingen aktiv session finns" });
			}

			const proposal = await Proposal.create({
				sessionId: activeSession._id,
				title,
				problem,
				solution,
				estimatedCost,
				authorId: session.user.id,
				authorName: session.user.name,
				status: "active",
				thumbsUpCount: 0,
			});

			// Broadcast new proposal event to all connected clients
			await broadcaster.broadcast("new-proposal", {
				_id: proposal._id.toString(),
				sessionId: proposal.sessionId.toString(),
				title: proposal.title,
				problem: proposal.problem,
				solution: proposal.solution,
				estimatedCost: proposal.estimatedCost,
				status: proposal.status,
				thumbsUpCount: 0,
				averageRating: 0,
				yesVotes: 0,
				noVotes: 0,
				authorId: proposal.authorId.toString(),
				authorName: proposal.authorName,
				createdAt: proposal.createdAt,
				commentsCount: 0,
			});

			return res.status(201).json({
				...proposal.toObject(),
				_id: proposal._id.toString(),
				authorId: proposal.authorId.toString(),
			});
		} catch (error) {
			console.error("Error creating proposal:", error);
			return res
				.status(500)
				.json({ message: "Ett fel uppstod vid skapande av förslag" });
		}
	}

	if (req.method === "PATCH") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { action, proposalIds } = req.body;

		if (
			action === "moveToTop3" &&
			proposalIds &&
			Array.isArray(proposalIds)
		) {
			try {
				await Proposal.updateMany(
					{ _id: { $in: proposalIds } },
					{ $set: { status: "top3" } }
				);

				return res.status(200).json({ message: "Topp 3 uppdaterad" });
			} catch (error) {
				console.error("Error updating proposals:", error);
				return res.status(500).json({ message: "Ett fel uppstod" });
			}
		}

		return res.status(400).json({ message: "Ogiltig förfrågan" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}
