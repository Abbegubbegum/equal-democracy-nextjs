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
 * Get the active session, or return null if none exists
 * @returns {Promise<Object|null>} The active session or null
 */
export async function ensureActiveSession() {
	const session = await getActiveSession();

	// DEBUG: Log what we found
	console.log("🔎 ENSUREACTIVESESSION - Found session:", session ? {
		name: session.name,
		status: session.status,
		id: session._id.toString()
	} : "NULL - no active session");

	return session;
}
