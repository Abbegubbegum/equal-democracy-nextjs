import { Session, User } from "./models";

/**
 * Check if admin can create more sessions
 * @param {string} userId - The admin's user ID
 * @returns {Promise<{canCreate: boolean, currentCount: number, limit: number, message?: string}>}
 */
export async function checkAdminSessionLimit(userId) {
	try {
		// Get user to check their session limit and admin status
		const user = await User.findById(userId);

		if (!user) {
			return {
				canCreate: false,
				currentCount: 0,
				limit: 0,
				message: "User not found",
			};
		}

		// Superadmins have unlimited sessions
		if (user.isSuperAdmin) {
			return {
				canCreate: true,
				currentCount: 0,
				limit: Infinity,
			};
		}

		// Regular admins have limits
		if (user.isAdmin && user.adminStatus === "approved") {
			// Count active sessions created by this admin
			const activeSessionCount = await Session.countDocuments({
				createdBy: userId,
				status: "active",
			});

			const limit = user.sessionLimit || 10;
			const canCreate = activeSessionCount < limit;

			return {
				canCreate,
				currentCount: activeSessionCount,
				limit,
				message: canCreate
					? undefined
					: `You have reached your session limit (${limit}). Please close an existing session or contact a superadmin to increase your limit.`,
			};
		}

		// Not an admin
		return {
			canCreate: false,
			currentCount: 0,
			limit: 0,
			message: "User is not an approved admin",
		};
	} catch (error) {
		console.error("Error checking admin session limit:", error);
		return {
			canCreate: false,
			currentCount: 0,
			limit: 0,
			message: "An error occurred while checking session limits",
		};
	}
}

/**
 * Check if user has admin or superadmin privileges
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function isAdmin(user) {
	return user?.isAdmin === true && user?.adminStatus === "approved";
}

/**
 * Check if user is a superadmin
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function isSuperAdmin(user) {
	return user?.isSuperAdmin === true;
}

/**
 * Check if user has at least admin privileges (admin or superadmin)
 * @param {Object} user - The user object from session
 * @returns {boolean}
 */
export function hasAdminAccess(user) {
	return isSuperAdmin(user) || isAdmin(user);
}
