import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Comment } from "../../../lib/models";

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "Du måste vara inloggad" });
	}

	if (req.method === "POST") {
		try {
			// Update all comments that don't have averageRating or have it as undefined/null
			const result = await Comment.updateMany(
				{
					$or: [
						{ averageRating: { $exists: false } },
						{ averageRating: null },
					],
				},
				{
					$set: { averageRating: 0 },
				}
			);

			return res.status(200).json({
				success: true,
				message: `Updated ${result.modifiedCount} comments`,
				modifiedCount: result.modifiedCount,
				matchedCount: result.matchedCount,
			});
		} catch (error) {
			console.error("Error migrating comment ratings:", error);
			return res.status(500).json({
				success: false,
				message: "Ett fel uppstod vid migrering",
				error: error.message,
			});
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
