import connectDB from "../../../lib/mongodb";
import {
	User,
	Proposal,
	Comment,
	ThumbsUp,
	FinalVote,
} from "../../../lib/models";
import { requireAdmin } from "../../../lib/admin";

export default async function handler(req, res) {
	await connectDB();
	const session = await requireAdmin(req, res);
	if (!session) return; // handled

	try {
		if (req.method === "GET") {
			const users = await User.find().sort({ createdAt: -1 }).lean();
			return res.status(200).json(
				users.map((u) => ({
					id: u._id.toString(),
					name: u.name,
					email: u.email,
					isAdmin: !!u.isAdmin,
					createdAt: u.createdAt,
				}))
			);
		}

		if (req.method === "PATCH") {
			const { id, updates } = req.body;
			if (!id || typeof updates !== "object") {
				return res
					.status(400)
					.json({ message: "id och updates krävs" });
			}
			const allowed = { name: 1, email: 1, isAdmin: 1, password: 0 }; // don't patch password here
			const safeUpdates = Object.fromEntries(
				Object.entries(updates).filter(([k]) => allowed[k])
			);
			const user = await User.findByIdAndUpdate(
				id,
				{ $set: safeUpdates },
				{ new: true }
			);
			if (!user)
				return res
					.status(404)
					.json({ message: "Användare hittades inte" });
			return res
				.status(200)
				.json({ id: user._id.toString(), isAdmin: !!user.isAdmin });
		}

		if (req.method === "DELETE") {
			const { id } = req.query;
			if (!id) return res.status(400).json({ message: "id krävs" });
			// Cascade delete user-related docs
			await Promise.all([
				Proposal.deleteMany({ authorId: id }),
				Comment.deleteMany({ userId: id }),
				ThumbsUp.deleteMany({ userId: id }),
				FinalVote.deleteMany({ userId: id }),
			]);
			await User.findByIdAndDelete(id);
			return res.status(204).end();
		}

		return res.status(405).json({ message: "Method not allowed" });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: "Ett fel uppstod" });
	}
}
