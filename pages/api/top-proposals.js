import dbConnect from "@/lib/mongodb";
import { TopProposal, Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

/**
 * Public endpoint to get winning proposals from the most recently closed session
 * Returns proposals with yes-majority from the latest closed session
 */
export default async function handler(req, res) {
	await dbConnect();

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			// Get the most recently closed session
			const latestClosedSession = await Session.findOne({
				status: "closed",
			}).sort({ endDate: -1 });

			if (!latestClosedSession) {
				return res.status(200).json([]);
			}

			// Get winning proposals from this session
			const winningProposals = await TopProposal.find({
				sessionId: latestClosedSession._id,
			}).sort({ yesVotes: -1 }); // Sort by yes votes descending

			// Format the response
			const formatted = winningProposals.map((tp) => ({
				_id: tp._id.toString(),
				sessionName: tp.sessionName,
				title: tp.title,
				problem: tp.problem,
				solution: tp.solution,
				estimatedCost: tp.estimatedCost,
				authorName: tp.authorName,
				yesVotes: tp.yesVotes,
				noVotes: tp.noVotes,
				archivedAt: tp.archivedAt,
			}));

			return res.status(200).json(formatted);
		} catch (error) {
			console.error("Error fetching winning proposals:", error);
			return res
				.status(500)
				.json({ error: "Failed to fetch winning proposals" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
