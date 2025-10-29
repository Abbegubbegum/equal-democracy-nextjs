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
 * @returns {Promise<Object>} The active session
 */
export async function ensureActiveSession() {
	let session = await getActiveSession();

	if (!session) {
		// Create a default first session
		const today = new Date();
		const dateStr = today.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6); // YYMMDD format

		session = await Session.create({
			name: `${dateStr}-Vallentuna`,
			municipalityName: "Vallentuna",
			status: "active",
			startDate: today,
		});
	}

	return session;
}
