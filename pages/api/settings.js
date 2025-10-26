import dbConnect from "@/lib/mongodb";
import { Settings } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
	await dbConnect();

	if (req.method === "GET") {
		try {
			// Get or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				// Create default settings if none exist
				settings = await Settings.create({
					municipalityName: "Vallentuna",
				});
			}

			return res.status(200).json({
				municipalityName: settings.municipalityName,
			});
		} catch (error) {
			console.error("Error fetching settings:", error);
			return res.status(500).json({ error: "Failed to fetch settings" });
		}
	}

	if (req.method === "PUT") {
		try {
			// Check if user is admin
			const session = await getServerSession(req, res, authOptions);
			if (!session || !session.user?.isAdmin) {
				return res.status(403).json({ error: "Unauthorized" });
			}

			const { municipalityName } = req.body;

			if (!municipalityName || typeof municipalityName !== "string") {
				return res.status(400).json({ error: "Invalid municipality name" });
			}

			if (municipalityName.length > 100) {
				return res.status(400).json({ error: "Municipality name too long (max 100 characters)" });
			}

			// Update or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				settings = await Settings.create({
					municipalityName: municipalityName.trim(),
				});
			} else {
				settings.municipalityName = municipalityName.trim();
				settings.updatedAt = new Date();
				await settings.save();
			}

			return res.status(200).json({
				municipalityName: settings.municipalityName,
			});
		} catch (error) {
			console.error("Error updating settings:", error);
			return res.status(500).json({ error: "Failed to update settings" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
