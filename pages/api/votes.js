import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { FinalVote } from "../../lib/models";

export default async function handler(req, res) {
	await connectDB();

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res.status(401).json({ message: "Du måste vara inloggad" });
		}

		const { proposalId, choice } = req.body;

		if (!proposalId || !choice) {
			return res
				.status(400)
				.json({ message: "Proposal ID och val krävs" });
		}

		if (!["yes", "no"].includes(choice)) {
			return res
				.status(400)
				.json({ message: 'Val måste vara "yes" eller "no"' });
		}

		try {
			const existingVote = await FinalVote.findOne({
				proposalId,
				userId: session.user.id,
			});

			if (existingVote) {
				return res
					.status(400)
					.json({ message: "Du har redan röstat på detta förslag" });
			}

			await FinalVote.create({
				proposalId,
				userId: session.user.id,
				choice,
			});

			const yesCount = await FinalVote.countDocuments({
				proposalId,
				choice: "yes",
			});
			const noCount = await FinalVote.countDocuments({
				proposalId,
				choice: "no",
			});

			return res.status(201).json({
				message: "Röst registrerad",
				results: {
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
				},
			});
		} catch (error) {
			console.error("Error creating vote:", error);
			return res.status(500).json({ message: "Ett fel uppstod" });
		}
	}

	if (req.method === "GET") {
		const { proposalId, userId } = req.query;

		if (proposalId) {
			try {
				const yesCount = await FinalVote.countDocuments({
					proposalId,
					choice: "yes",
				});
				const noCount = await FinalVote.countDocuments({
					proposalId,
					choice: "no",
				});

				let hasVoted = false;
				if (userId) {
					hasVoted = await FinalVote.exists({ proposalId, userId });
				}

				return res.status(200).json({
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
					hasVoted: !!hasVoted,
				});
			} catch (error) {
				console.error("Error fetching vote results:", error);
				return res.status(500).json({ message: "Ett fel uppstod" });
			}
		}

		return res.status(400).json({ message: "Proposal ID krävs" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}
