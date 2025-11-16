import dbConnect from "@/lib/mongodb";
import { Session, Proposal, FinalVote, TopProposal } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess, isSuperAdmin } from "@/lib/admin-helper";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user has admin access
	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { sessionId } = req.body;

		if (!sessionId) {
			return res.status(400).json({ error: "Session ID is required" });
		}

		// Get the session
		const sessionToClose = await Session.findById(sessionId);
		if (!sessionToClose) {
			return res.status(404).json({ error: "Session not found" });
		}

		if (sessionToClose.status === "closed") {
			return res.status(400).json({ error: "Session is already closed" });
		}

		// Check if user is authorized to close this session
		// Only the creator or a superadmin can close a session
		if (
			!isSuperAdmin(session.user) &&
			sessionToClose.createdBy?.toString() !== session.user.id
		) {
			return res.status(403).json({
				error: "You can only close sessions that you created",
			});
		}

		// Get all top3 proposals from this session
		const top3Proposals = await Proposal.find({
			sessionId: sessionId,
			status: "top3",
		});

		const topProposals = [];

		// For each top3 proposal, calculate votes and check if it has yes-majority
		for (const proposal of top3Proposals) {
			const votes = await FinalVote.find({ proposalId: proposal._id });

			const yesVotes = votes.filter((v) => v.choice === "yes").length;
			const noVotes = votes.filter((v) => v.choice === "no").length;

			// Only save proposals with yes-majority
			if (yesVotes > noVotes) {
				const topProposal = await TopProposal.create({
					sessionId: sessionToClose._id,
					sessionPlace: sessionToClose.place,
					sessionStartDate: sessionToClose.startDate,
					proposalId: proposal._id,
					title: proposal.title,
					problem: proposal.problem,
					solution: proposal.solution,
					authorName: proposal.authorName,
					yesVotes: yesVotes,
					noVotes: noVotes,
					archivedAt: new Date(),
				});
				topProposals.push(topProposal);
			}
		}

		// Archive all proposals in this session
		await Proposal.updateMany(
			{ sessionId: sessionId },
			{ status: "archived" }
		);

		// Close the session
		sessionToClose.status = "closed";
		sessionToClose.endDate = new Date();
		await sessionToClose.save();

		return res.status(200).json({
			message: "Session closed successfully",
			session: sessionToClose,
			topProposals: topProposals,
		});
	} catch (error) {
		console.error("Error closing session:", error);
		return res.status(500).json({ error: "Failed to close session" });
	}
}
