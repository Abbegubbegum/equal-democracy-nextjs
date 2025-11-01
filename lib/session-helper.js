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
 * Register a user as active in the current session
 * Only called when user performs an action (creates proposal, rates, votes, comments)
 * @param {string} userId - The user's ID
 * @returns {Promise<boolean>} True if user was added, false if already active
 */
export async function registerActiveUser(userId) {
	const activeSession = await getActiveSession();

	if (!activeSession) {
		console.log("No active session found, skipping active user registration");
		return false;
	}

	// Initialize activeUsers array if it doesn't exist
	if (!activeSession.activeUsers) {
		activeSession.activeUsers = [];
	}

	// Check if user is already in activeUsers array
	const isAlreadyActive = activeSession.activeUsers.some(
		(id) => id.toString() === userId.toString()
	);

	if (!isAlreadyActive) {
		// Add user to activeUsers array
		activeSession.activeUsers.push(userId);
		await activeSession.save();
		console.log(`User ${userId} registered as active in session for ${activeSession.place}`);
		return true;
	}

	return false;
}
