import { getSession } from "next-auth/react";
import connectDB from "../../../lib/mongodb";
import { Proposal, ThumbsUp, Comment } from "../../../lib/models";

export default async function handler(req, res) {
	await connectDB();

	if (req.method === "GET") {
		try {
			const proposals = await Proposal.find()
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
		const session = await getSession({ req });

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { title, description } = req.body;

		if (!title || !description) {
			return res
				.status(400)
				.json({ message: "Titel och beskrivning krävs" });
		}

		try {
			const proposal = await Proposal.create({
				title,
				description,
				authorId: session.user.id,
				authorName: session.user.name,
				status: "active",
				thumbsUpCount: 0,
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
		const session = await getSession({ req });

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
