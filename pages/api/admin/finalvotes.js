import connectDB from "../../../lib/mongodb";
import { FinalVote } from "../../../lib/models";
import { requireAdmin } from "../../../lib/admin";

export default async function handler(req, res) {
	await connectDB();
	const session = await requireAdmin(req, res);
	if (!session) return;

	try {
		if (req.method === "GET") {
			const { proposalId, userId } = req.query;
			const filter = {};
			if (proposalId) filter.proposalId = proposalId;
			if (userId) filter.userId = userId;
			const data = await FinalVote.find(filter)
				.sort({ createdAt: -1 })
				.lean();
			return res.status(200).json(
				data.map((v) => ({
					id: v._id.toString(),
					proposalId: v.proposalId?.toString?.() || null,
					userId: v.userId?.toString?.() || null,
					choice: v.choice,
					createdAt: v.createdAt,
				}))
			);
		}

		if (req.method === "DELETE") {
			const { id } = req.query;
			if (!id) return res.status(400).json({ message: "id krävs" });
			await FinalVote.findByIdAndDelete(id);
			return res.status(204).end();
		}

		return res.status(405).json({ message: "Method not allowed" });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: "Ett fel uppstod" });
	}
}
