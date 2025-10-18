import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { ThumbsUp, Proposal } from "../../lib/models";

export default async function handler(req, res) {
	await connectDB();

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId } = req.body;

		if (!proposalId) {
			return res.status(400).json({ message: "Proposal ID krävs" });
		}

		try {
			const existingVote = await ThumbsUp.findOne({
				proposalId,
				userId: session.user.id,
			});

			if (existingVote) {
				return res
					.status(400)
					.json({ message: "Du har redan röstat på detta förslag" });
			}

			await ThumbsUp.create({
				proposalId,
				userId: session.user.id,
			});

			const count = await ThumbsUp.countDocuments({ proposalId });
			await Proposal.findByIdAndUpdate(proposalId, {
				thumbsUpCount: count,
			});

			return res.status(201).json({ message: "Röst registrerad", count });
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
