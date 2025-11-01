import { Session } from "./models";

/**
 * Get the current active session
 * @returns {Promise<Object|null>} The active session or null
 */
export async function getActiveSession() {
	const activeSession = await Session.findOne({ status: "active" });
	return activeSession;
}
