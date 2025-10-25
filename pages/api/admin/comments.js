import connectDB from "../../../lib/mongodb";
import { Comment, Proposal } from "../../../lib/models";
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

			const data = await Comment.find(filter)
				.sort({ createdAt: -1 })
				.lean();

			// Collect proposal ids and build title map
			const proposalIds = [
				...new Set(
					data.map((c) => c.proposalId?.toString?.()).filter(Boolean)
				),
			];

			const proposals = proposalIds.length
				? await Proposal.find({ _id: { $in: proposalIds } })
						.select("title")
						.lean()
				: [];

			const proposalTitleById = Object.fromEntries(
				proposals.map((p) => [p._id.toString(), p.title])
			);

			return res.status(200).json(
				data.map((c) => ({
					id: c._id.toString(),
					proposalId: c.proposalId?.toString?.() || null,
					proposalTitle:
						proposalTitleById[c.proposalId?.toString?.()] || null,
					userId: c.userId?.toString?.() || null,
					authorName: c.authorName,
					text: c.text,
					createdAt: c.createdAt,
				}))
			);
		}

		if (req.method === "DELETE") {
			const { id } = req.query;
			if (!id) return res.status(400).json({ message: "id krävs" });
			await Comment.findByIdAndDelete(id);
			return res.status(204).end();
		}

		return res.status(405).json({ message: "Method not allowed" });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: "Ett fel uppstod" });
	}
}
