import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { sendAdminApplicationNotification } from "../../../lib/email";

export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	// CSRF protection
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	try {
		const { requestedSessions } = req.body;

		// Validate input
		if (!requestedSessions) {
			return res
				.status(400)
				.json({ message: "Requested sessions is required" });
		}

		const sessions = parseInt(requestedSessions);
		if (isNaN(sessions) || sessions < 1 || sessions > 50) {
			return res.status(400).json({
				message: "Requested sessions must be between 1 and 50",
			});
		}

		const user = await User.findById(session.user.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Only admins (not superadmins) should request more sessions
		if (!user.isAdmin || user.isSuperAdmin) {
			return res.status(400).json({
				message: "Only light admins can request more sessions",
			});
		}

		// Update user with request
		user.requestedSessions = sessions;
		user.appliedForAdminAt = new Date(); // Update timestamp
		await user.save();

		// Send email notifications to all superadmins
		try {
			const superadmins = await User.find({ isSuperAdmin: true });

			// Send email to each superadmin
			for (const superadmin of superadmins) {
				if (superadmin.email) {
					await sendAdminApplicationNotification(
						superadmin.email,
						user.name,
						user.email,
						user.organization || "N/A",
						sessions,
						"sv" // Default to Swedish, could be made configurable
					);
				}
			}
		} catch (emailError) {
			// Log error but don't fail the request
			console.error("Error sending request emails:", emailError);
		}

		return res.status(200).json({
			message:
				"Your request for more sessions has been submitted. A superadmin will review it shortly.",
		});
	} catch (error) {
		console.error("Error requesting more sessions:", error);
		return res.status(500).json({ message: "An error occurred" });
	}
}
