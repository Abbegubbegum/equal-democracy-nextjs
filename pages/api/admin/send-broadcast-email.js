import dbConnect from "@/lib/mongodb";
import { User } from "@/lib/models";
import { sendBroadcastEmail } from "@/lib/email";
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
		const { subject, message } = req.body;

		if (!subject || !message) {
			return res.status(400).json({ error: "Subject and message are required" });
		}

		// Get all users
		const users = await User.find({});

		// Send email to each user
		let successCount = 0;
		let errorCount = 0;

		for (const user of users) {
			try {
				await sendBroadcastEmail(user.email, subject, message);
				successCount++;
			} catch (emailError) {
				console.error(`Failed to send email to ${user.email}:`, emailError);
				errorCount++;
			}
		}

		return res.status(200).json({
			message: "Broadcast emails sent",
			totalUsers: users.length,
			successCount,
			errorCount,
		});
	} catch (error) {
		console.error("Error sending broadcast emails:", error);
		return res.status(500).json({ error: "Failed to send broadcast emails" });
	}
}
