import connectDB from "../../../lib/mongodb";
import { FinalVote, User, Proposal } from "../../../lib/models";
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

			const userIds = [
				...new Set(
					data.map((v) => v.userId?.toString?.()).filter(Boolean)
				),
			];
			const proposalIds = [
				...new Set(
					data.map((v) => v.proposalId?.toString?.()).filter(Boolean)
				),
			];

			const [users, proposals] = await Promise.all([
				userIds.length
					? User.find({ _id: { $in: userIds } })
							.select("name")
							.lean()
					: [],
				proposalIds.length
					? Proposal.find({ _id: { $in: proposalIds } })
							.select("title")
							.lean()
					: [],
			]);

			const userNameById = Object.fromEntries(
				users.map((u) => [u._id.toString(), u.name])
			);
			const proposalTitleById = Object.fromEntries(
				proposals.map((p) => [p._id.toString(), p.title])
			);

			return res.status(200).json(
				data.map((v) => ({
					id: v._id.toString(),
					proposalId: v.proposalId?.toString?.() || null,
					proposalTitle:
						proposalTitleById[v.proposalId?.toString?.()] || null,
					userId: v.userId?.toString?.() || null,
					userName: userNameById[v.userId?.toString?.()] || null,
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
