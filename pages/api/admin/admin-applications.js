import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { isSuperAdmin } from "../../../lib/admin-helper";

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	// Only superadmins can access this endpoint
	if (!isSuperAdmin(session.user)) {
		return res.status(403).json({ message: "Superadmin access required" });
	}

	// GET - List all pending applications
	if (req.method === "GET") {
		try {
			const pendingApplications = await User.find({
				adminStatus: "pending",
			})
				.select("name email appliedForAdminAt organization requestedSessions createdAt")
				.sort({ appliedForAdminAt: -1 });

			return res.status(200).json({ applications: pendingApplications });
		} catch (error) {
			console.error("Error fetching admin applications:", error);
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Approve or deny an application
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		const { userId, action, sessionLimit } = req.body;

		if (!userId || !action) {
			return res
				.status(400)
				.json({ message: "User ID and action are required" });
		}

		if (!["approve", "deny"].includes(action)) {
			return res
				.status(400)
				.json({ message: "Action must be 'approve' or 'deny'" });
		}

		if (action === "approve" && sessionLimit) {
			if (sessionLimit < 1 || sessionLimit > 50) {
				return res.status(400).json({
					message: "Session limit must be between 1 and 50",
				});
			}
		}

		try {
			const user = await User.findById(userId);

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			if (user.adminStatus !== "pending") {
				return res.status(400).json({
					message: "User does not have a pending application",
				});
			}

			if (action === "approve") {
				user.isAdmin = true;
				user.adminStatus = "approved";
				user.sessionLimit = sessionLimit || 10;
			} else {
				user.adminStatus = "denied";
			}

			await user.save();

			return res.status(200).json({
				message: `Admin application ${action}ed successfully`,
				user: {
					_id: user._id,
					name: user.name,
					email: user.email,
					adminStatus: user.adminStatus,
					sessionLimit: user.sessionLimit,
				},
			});
		} catch (error) {
			console.error("Error processing admin application:", error);
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
