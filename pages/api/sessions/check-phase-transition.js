import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

/**
 * Checks if automatic phase transition should occur
 * Triggers when 75% of proposals have been rated
 */
export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		// Get active session
		const activeSession = await Session.findOne({ status: "active" });

		if (!activeSession || activeSession.phase !== "phase1") {
			return res.status(200).json({ shouldTransition: false });
		}

		// Count total proposals
		const totalProposals = await Proposal.countDocuments({
			sessionId: activeSession._id,
			status: "active",
		});

		// Need at least 2 proposals to transition
		if (totalProposals < 2) {
			return res.status(200).json({
				shouldTransition: false,
				reason: "Minst 2 förslag krävs",
				progress: {
					total: totalProposals,
					rated: 0,
					percentage: 0,
				},
			});
		}

		// Get all proposal IDs
		const proposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "active",
		}).select("_id");

		const proposalIds = proposals.map((p) => p._id);

		// Count how many proposals have at least one rating
		const ratedProposalsCount = await Promise.all(
			proposalIds.map(async (id) => {
				const count = await ThumbsUp.countDocuments({ proposalId: id });
				return count > 0 ? 1 : 0;
			})
		).then((results) => results.reduce((sum, val) => sum + val, 0));

		const percentage = (ratedProposalsCount / totalProposals) * 100;
		const shouldTransition = percentage >= 75;

		return res.status(200).json({
			shouldTransition,
			progress: {
				total: totalProposals,
				rated: ratedProposalsCount,
				percentage: Math.round(percentage),
			},
		});
	} catch (error) {
		console.error("Error checking phase transition:", error);
		return res.status(500).json({ error: "Failed to check transition" });
	}
}
