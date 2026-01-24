import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, MunicipalSession } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { extractAgendaFromURL } from "../../../lib/municipal/agenda-extractor";

/**
 * POST /api/municipal/extract-agenda
 * Extract items from municipal agenda URL
 * Superadmin only
 */
export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	if (!user) {
		return res.status(404).json({ message: "User not found" });
	}

	// Only superadmins can extract agendas
	if (!user.isSuperAdmin) {
		return res.status(403).json({ message: "Superadmin access required" });
	}

	// CSRF protection
	if (!csrfProtection(req, res)) {
		return;
	}

	try {
		const { url, meetingType } = req.body;

		if (!url) {
			return res.status(400).json({ message: "URL is required" });
		}

		// Validate URL format
		try {
			new URL(url);
		} catch {
			return res.status(400).json({ message: "Invalid URL format" });
		}

		console.log(`[ExtractAgenda] Extracting agenda from: ${url}`);

		// Extract items from PDF using AI
		const extractedData = await extractAgendaFromURL(url, meetingType || "Kommunfullmäktige");

		// Parse meeting date
		let meetingDate = new Date();
		if (extractedData.meetingDate) {
			try {
				meetingDate = new Date(extractedData.meetingDate);
			} catch {
				console.warn("[ExtractAgenda] Failed to parse meeting date, using current date");
			}
		}

		// Create draft municipal session
		const municipalSession = new MunicipalSession({
			name: extractedData.meetingName || `${meetingType}_${meetingDate.toISOString().slice(0, 10).replace(/-/g, "")}`,
			meetingDate: meetingDate,
			meetingType: meetingType || "Kommunfullmäktige",
			sourceUrl: url,
			status: "draft",
			createdBy: user._id,
			items: extractedData.items.map(item => ({
				originalNumber: item.originalNumber || "",
				title: item.title,
				description: item.description,
				categories: item.categories || [],
				initialArguments: item.initialArguments || [],
				status: "draft",
			})),
			notificationsSent: false,
		});

		await municipalSession.save();

		console.log(`[ExtractAgenda] Created draft session: ${municipalSession._id}`);

		return res.status(201).json({
			message: "Agenda extracted successfully",
			session: {
				_id: municipalSession._id.toString(),
				name: municipalSession.name,
				meetingDate: municipalSession.meetingDate,
				itemCount: municipalSession.items.length,
				items: municipalSession.items,
			},
		});
	} catch (error) {
		console.error("[ExtractAgenda] Error:", error);
		return res.status(500).json({
			message: "Failed to extract agenda",
			error: error.message,
		});
	}
}
