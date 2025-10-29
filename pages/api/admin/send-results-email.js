import dbConnect from "@/lib/mongodb";
import { Session, User, Proposal, Comment, ThumbsUp, FinalVote, TopProposal } from "@/lib/models";
import { sendSessionResultsEmail } from "@/lib/email";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user is admin
	const session = await getServerSession(req, res, authOptions);
	if (!session || !session.user?.isAdmin) {
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
		const targetSession = await Session.findById(sessionId);
		if (!targetSession) {
			return res.status(404).json({ error: "Session not found" });
		}

		// Get all top proposals from this session
		const topProposals = await TopProposal.find({ sessionId: sessionId });

		// Get all unique participants (users who created proposals, commented, or voted)
		const proposalAuthors = await Proposal.find({ sessionId: sessionId }).distinct("authorId");
		const commentAuthors = await Comment.find({ sessionId: sessionId }).distinct("userId");
		const thumbsUpUsers = await ThumbsUp.find({ sessionId: sessionId }).distinct("userId");
		const voteUsers = await FinalVote.find({ sessionId: sessionId }).distinct("userId");

		// Combine all user IDs and remove duplicates
		const participantIds = [
			...new Set([
				...proposalAuthors.map((id) => id.toString()),
				...commentAuthors.map((id) => id.toString()),
				...thumbsUpUsers.map((id) => id.toString()),
				...voteUsers.map((id) => id.toString()),
			]),
		];

		// Get user emails
		const participants = await User.find({
			_id: { $in: participantIds },
		});

		// Send email to each participant
		let successCount = 0;
		let errorCount = 0;

		for (const user of participants) {
			try {
				await sendSessionResultsEmail(
					user.email,
					targetSession.name,
					topProposals.map((tp) => ({
						title: tp.title,
						yesVotes: tp.yesVotes,
						noVotes: tp.noVotes,
					}))
				);
				successCount++;
			} catch (emailError) {
				console.error(`Failed to send email to ${user.email}:`, emailError);
				errorCount++;
			}
		}

		return res.status(200).json({
			message: "Results emails sent",
			totalParticipants: participants.length,
			successCount,
			errorCount,
		});
	} catch (error) {
		console.error("Error sending results emails:", error);
		return res.status(500).json({ error: "Failed to send results emails" });
	}
}
