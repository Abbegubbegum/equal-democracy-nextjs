import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, MunicipalSession, Proposal, Session, Comment } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { sendMunicipalSessionNotifications } from "../../../lib/municipal/notifications";

/**
 * GET/PATCH/DELETE /api/municipal/sessions
 * Manage municipal sessions
 * Superadmin only
 */
export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	if (!user || !user.isSuperAdmin) {
		return res.status(403).json({ message: "Superadmin access required" });
	}

	// GET - List all municipal sessions
	if (req.method === "GET") {
		try {
			const { status, limit } = req.query;

			const query = {};
			if (status) {
				query.status = status;
			}

			const sessions = await MunicipalSession.find(query)
				.populate("createdBy", "name email")
				.sort({ meetingDate: -1 })
				.limit(limit ? parseInt(limit) : 50);

			return res.status(200).json({ sessions });
		} catch (error) {
			console.error("[MunicipalSessions] Error fetching sessions:", error);
			return res.status(500).json({ message: "Failed to fetch sessions" });
		}
	}

	// PATCH - Update municipal session (or publish it)
	if (req.method === "PATCH") {
		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { sessionId, action, updates } = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID required" });
			}

			const municipalSession = await MunicipalSession.findById(sessionId);

			if (!municipalSession) {
				return res.status(404).json({ message: "Session not found" });
			}

			// Action: Publish (create sessions and proposals for each item)
			if (action === "publish") {
				if (municipalSession.status !== "draft") {
					return res.status(400).json({ message: "Only draft sessions can be published" });
				}

				// Create a standard Session and Proposals for each item
				for (let i = 0; i < municipalSession.items.length; i++) {
					const item = municipalSession.items[i];

					// Create a Session for this item (phase2 + voting)
					const itemSession = new Session({
						place: `${municipalSession.name} - ${item.title}`,
						sessionType: "standard",
						status: "active",
						phase: "phase2", // Skip phase1, go straight to debate
						createdBy: user._id,
						startDate: new Date(),
						showUserCount: true,
						noMotivation: false,
					});

					await itemSession.save();

					// Create a Proposal for this item
					const proposal = new Proposal({
						sessionId: itemSession._id,
						title: item.title,
						problem: "", // Description goes in initial arguments instead
						solution: item.description,
						authorId: user._id,
						authorName: municipalSession.meetingType,
						status: "top3", // Immediately promote to voting
					});

					await proposal.save();

					// Create initial arguments as Comments
					for (const arg of item.initialArguments || []) {
						const comment = new Comment({
							proposalId: proposal._id,
							sessionId: itemSession._id,
							userId: user._id,
							authorName: municipalSession.meetingType,
							text: arg.text,
							type: arg.type,
						});

						await comment.save();
					}

					// Update the item with references
					item.proposalId = proposal._id;
					item.sessionId = itemSession._id;
					item.status = "active";
				}

				municipalSession.status = "active";
				await municipalSession.save();

				console.log(`[MunicipalSessions] Published session ${sessionId} with ${municipalSession.items.length} items`);

				// Send notifications to users based on categories
				try {
					const notificationResults = await sendMunicipalSessionNotifications(municipalSession);
					console.log(`[MunicipalSessions] Notifications sent: ${notificationResults.emailsSent} emails, ${notificationResults.smsSent} SMS`);
					municipalSession.notificationsSent = true;
					await municipalSession.save();
				} catch (error) {
					console.error("[MunicipalSessions] Failed to send notifications:", error);
					// Don't fail the entire publish if notifications fail
				}

				return res.status(200).json({
					message: "Session published successfully",
					session: municipalSession,
				});
			}

			// Action: Update items or session details
			if (action === "update") {
				if (updates.name) municipalSession.name = updates.name;
				if (updates.meetingDate) municipalSession.meetingDate = new Date(updates.meetingDate);
				if (updates.meetingType) municipalSession.meetingType = updates.meetingType;
				if (updates.items) municipalSession.items = updates.items;

				await municipalSession.save();

				return res.status(200).json({
					message: "Session updated successfully",
					session: municipalSession,
				});
			}

			return res.status(400).json({ message: "Invalid action" });
		} catch (error) {
			console.error("[MunicipalSessions] Error updating session:", error);
			return res.status(500).json({
				message: "Failed to update session",
				error: error.message,
			});
		}
	}

	// DELETE - Delete municipal session
	if (req.method === "DELETE") {
		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { sessionId } = req.query;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID required" });
			}

			const municipalSession = await MunicipalSession.findById(sessionId);

			if (!municipalSession) {
				return res.status(404).json({ message: "Session not found" });
			}

			// Only allow deletion of draft sessions
			if (municipalSession.status !== "draft") {
				return res.status(400).json({ message: "Only draft sessions can be deleted" });
			}

			await MunicipalSession.findByIdAndDelete(sessionId);

			return res.status(200).json({ message: "Session deleted successfully" });
		} catch (error) {
			console.error("[MunicipalSessions] Error deleting session:", error);
			return res.status(500).json({ message: "Failed to delete session" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
