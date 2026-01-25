/**
 * Municipal Session Notification System
 * Send notifications to users based on their interested categories
 */

import { User } from "../models";
import { sendEmail } from "../email";
import { sendSMS, formatPhoneNumber } from "../sms";
import { getCategoryName } from "./agenda-extractor";

/**
 * Send notifications for a new municipal session
 * @param {Object} municipalSession - MunicipalSession document
 * @returns {Promise<Object>} - Notification results
 */
export async function sendMunicipalSessionNotifications(municipalSession) {
	try {
		// Collect all unique categories from all items
		const allCategories = new Set();
		for (const item of municipalSession.items) {
			for (const cat of item.categories || []) {
				allCategories.add(cat);
			}
		}

		const categoriesArray = Array.from(allCategories);

		console.log(
			`[Notifications] Sending notifications for session ${municipalSession.name}, categories: ${categoriesArray.join(", ")}`
		);

		// Find all users interested in these categories
		const interestedUsers = await User.find({
			interestedCategories: { $in: categoriesArray },
			userType: { $in: ["member", "citizen"] }, // Only notify registered users
			notificationPreference: { $ne: "none" }, // Skip users who disabled notifications
		});

		console.log(`[Notifications] Found ${interestedUsers.length} interested users`);

		const results = {
			totalUsers: interestedUsers.length,
			emailsSent: 0,
			smsSent: 0,
			errors: [],
		};

		// Send notifications to each user
		for (const user of interestedUsers) {
			// Find which items match this user's interests
			const relevantItems = municipalSession.items.filter((item) =>
				item.categories.some((cat) => user.interestedCategories.includes(cat))
			);

			if (relevantItems.length === 0) continue;

			// Create notification message
			const meetingDate = new Date(municipalSession.meetingDate).toLocaleDateString(
				"sv-SE",
				{
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric",
				}
			);

			const itemsList = relevantItems
				.map((item) => `• ${item.title}`)
				.slice(0, 5)
				.join("\n");

			const moreText =
				relevantItems.length > 5 ? `\n...och ${relevantItems.length - 5} till` : "";

			// Email notification
			if (
				user.notificationPreference === "email" ||
				user.notificationPreference === "both"
			) {
				const emailSubject = `${municipalSession.meetingType} ${meetingDate} - Frågor i dina intresseområden`;

				const emailBody = `
Hej ${user.name}!

${municipalSession.meetingType} ska hålla möte ${meetingDate}.

Det finns ${relevantItems.length} frågor som berör dina intresseområden:

${itemsList}${moreText}

Du kan debattera och rösta på dessa frågor på vallentuna.app

Dina intresseområden: ${user.interestedCategories.map((c) => getCategoryName(c)).join(", ")}

Röstning för ${user.userType === "member" ? "medlemmar: 1 röst per möte" : "medborgare: 1 röst per år"}

Med vänliga hälsningar,
Equal Democracy Vallentuna
				`.trim();

				try {
					await sendEmail(user.email, emailSubject, emailBody);
					results.emailsSent++;
					console.log(`[Notifications] Email sent to ${user.email}`);
				} catch (error) {
					console.error(`[Notifications] Failed to send email to ${user.email}:`, error);
					results.errors.push({
						userId: user._id,
						type: "email",
						error: error.message,
					});
				}
			}

			// SMS notification
			if (
				user.notificationPreference === "sms" ||
				user.notificationPreference === "both"
			) {
				if (!user.phoneNumber) {
					console.warn(`[Notifications] User ${user._id} wants SMS but has no phone number`);
					continue;
				}

				const smsBody = `${municipalSession.meetingType} ${new Date(municipalSession.meetingDate).toLocaleDateString("sv-SE")}: ${relevantItems.length} frågor i dina intresseområden. Rösta på vallentuna.app`;

				const formattedPhone = formatPhoneNumber(user.phoneNumber);

				if (!formattedPhone) {
					console.warn(
						`[Notifications] Invalid phone number for user ${user._id}: ${user.phoneNumber}`
					);
					results.errors.push({
						userId: user._id,
						type: "sms",
						error: "Invalid phone number",
					});
					continue;
				}

				try {
					const smsResult = await sendSMS(formattedPhone, smsBody);
					if (smsResult.success) {
						results.smsSent++;
						console.log(`[Notifications] SMS sent to ${formattedPhone}`);
					} else {
						results.errors.push({
							userId: user._id,
							type: "sms",
							error: smsResult.error,
						});
					}
				} catch (error) {
					console.error(
						`[Notifications] Failed to send SMS to ${formattedPhone}:`,
						error
					);
					results.errors.push({
						userId: user._id,
						type: "sms",
						error: error.message,
					});
				}
			}

			// Small delay between users to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.log(
			`[Notifications] Completed: ${results.emailsSent} emails, ${results.smsSent} SMS, ${results.errors.length} errors`
		);

		return results;
	} catch (error) {
		console.error("[Notifications] Error sending notifications:", error);
		throw error;
	}
}

/**
 * Send test notification to a specific user
 * @param {string} userId - User ID
 * @param {string} type - "email" or "sms"
 * @returns {Promise<Object>} - Result
 */
export async function sendTestNotification(userId, type = "email") {
	const user = await User.findById(userId);

	if (!user) {
		throw new Error("User not found");
	}

	const testMessage = `Detta är ett testmeddelande från Equal Democracy. Dina intresseområden: ${user.interestedCategories.map((c) => getCategoryName(c)).join(", ")}`;

	if (type === "email") {
		await sendEmail(
			user.email,
			"Testnotifikation från Equal Democracy",
			testMessage
		);
		return { success: true, type: "email", to: user.email };
	} else if (type === "sms") {
		if (!user.phoneNumber) {
			throw new Error("User has no phone number");
		}

		const formattedPhone = formatPhoneNumber(user.phoneNumber);
		if (!formattedPhone) {
			throw new Error("Invalid phone number format");
		}

		const result = await sendSMS(formattedPhone, testMessage);
		return { ...result, type: "sms", to: formattedPhone };
	} else {
		throw new Error("Invalid notification type");
	}
}
