import dbConnect from "@/lib/mongodb";
import { Settings } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "GET") {
		try {
			// Get or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				// Create default settings if none exist
				settings = await Settings.create({
					municipalityName: "Vallentuna",
					phase2DurationHours: 6,
				});
			}

			return res.status(200).json({
				municipalityName: settings.municipalityName,
				phase2DurationHours: settings.phase2DurationHours || 6,
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

			const { municipalityName, phase2DurationHours } = req.body;

			if (municipalityName && typeof municipalityName !== "string") {
				return res.status(400).json({ error: "Invalid municipality name" });
			}

			if (municipalityName && municipalityName.length > 100) {
				return res.status(400).json({ error: "Municipality name too long (max 100 characters)" });
			}

			if (phase2DurationHours !== undefined) {
				const hours = Number(phase2DurationHours);
				if (isNaN(hours) || hours < 1 || hours > 168) {
					return res.status(400).json({ error: "Phase 2 duration must be between 1 and 168 hours" });
				}
			}

			// Update or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				settings = await Settings.create({
					municipalityName: municipalityName ? municipalityName.trim() : "Vallentuna",
					phase2DurationHours: phase2DurationHours || 6,
				});
			} else {
				if (municipalityName) {
					settings.municipalityName = municipalityName.trim();
				}
				if (phase2DurationHours !== undefined) {
					settings.phase2DurationHours = Number(phase2DurationHours);
				}
				settings.updatedAt = new Date();
				await settings.save();
			}

			return res.status(200).json({
				municipalityName: settings.municipalityName,
				phase2DurationHours: settings.phase2DurationHours,
			});
		} catch (error) {
			console.error("Error updating settings:", error);
			return res.status(500).json({ error: "Failed to update settings" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
