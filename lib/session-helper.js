import { Session } from "./models";

/**
 * Get the current active session
 * @returns {Promise<Object|null>} The active session or null
 */
export async function getActiveSession() {
	const activeSession = await Session.findOne({ status: "active" });
	return activeSession;
}

/**
 * Get the active session ID or throw an error
 * @returns {Promise<string>} The active session ID
 * @throws {Error} If no active session exists
 */
export async function getActiveSessionId() {
	const session = await getActiveSession();
	if (!session) {
		throw new Error("No active session found");
	}
	return session._id.toString();
}

/**
 * Ensure there is an active session, or create a default one
 * Uses atomic findOneAndUpdate to prevent race conditions
 * @returns {Promise<Object>} The active session
 */
export async function ensureActiveSession() {
	let session = await getActiveSession();

	// DEBUG: Log what we found
	console.log("🔎 ENSUREACTIVESESSION - Found session:", session ? {
		name: session.name,
		status: session.status,
		id: session._id.toString()
	} : "NULL - will create default");

	if (!session) {
		// Create a default first session atomically to prevent duplicates
		const today = new Date();

		// Format: YYMMDD, HH:MM (e.g., 251030, 14:35)
		const year = today.getFullYear().toString().slice(2);
		const month = (today.getMonth() + 1).toString().padStart(2, '0');
		const day = today.getDate().toString().padStart(2, '0');
		const hours = today.getHours().toString().padStart(2, '0');
		const minutes = today.getMinutes().toString().padStart(2, '0');
		const dateTimeStr = `${year}${month}${day}, ${hours}:${minutes}`;

		// Use findOneAndUpdate with upsert to atomically create session if none exists
		// This prevents race conditions where multiple requests create sessions simultaneously
		session = await Session.findOneAndUpdate(
			{ status: "active" }, // Try to find an active session
			{
				$setOnInsert: {
					name: `${dateTimeStr}-Vallentuna`,
					municipalityName: "Vallentuna",
					status: "active",
					phase: "phase1",
					startDate: today,
					activeUsers: [],
					userReadyPhase1: [],
				}
			},
			{
				upsert: true, // Create if doesn't exist
				new: true, // Return the document after update
				setDefaultsOnInsert: true, // Apply schema defaults on insert
			}
		);
	}

	return session;
}
