import dbConnect from "@/lib/mongodb";
import { Session, User, TopProposal } from "@/lib/models";
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

		// Get all participants from the session's activeUsers array
		const participantIds = targetSession.activeUsers || [];

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
					targetSession.place,
					topProposals.map((tp) => ({
						title: tp.title,
						yesVotes: tp.yesVotes,
						noVotes: tp.noVotes,
					}))
				);
				successCount++;
			} catch (emailError) {
				console.error(
					`Failed to send email to ${user.email}:`,
					emailError
				);
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
