import Pusher from "pusher";

/**
 * Pusher Broadcaster for Real-Time Events
 * Serverless-compatible replacement for SSE
 * Broadcasts events to all connected clients via Pusher channels
 */

class PusherBroadcaster {
	constructor() {
		this.pusher = null;
		this.initPusher();
	}

	initPusher() {
		// Check if Pusher is configured
		if (
			!process.env.PUSHER_APP_ID ||
			!process.env.PUSHER_KEY ||
			!process.env.PUSHER_SECRET ||
			!process.env.PUSHER_CLUSTER
		) {
			console.warn(
				"[Pusher] Pusher not configured. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER environment variables."
			);
			return;
		}

		this.pusher = new Pusher({
			appId: process.env.PUSHER_APP_ID,
			key: process.env.PUSHER_KEY,
			secret: process.env.PUSHER_SECRET,
			cluster: process.env.PUSHER_CLUSTER,
			useTLS: true,
		});

		console.log("[Pusher] Broadcaster initialized");
	}

	/**
	 * Broadcast an event to all connected clients
	 * @param {string} eventType - Type of event (e.g., 'new-proposal', 'phase-change')
	 * @param {Object} data - Event data
	 */
	async broadcast(eventType, data) {
		if (!this.pusher) {
			console.warn(`[Pusher] Not configured. Event ${eventType} not broadcast.`);
			return;
		}

		try {
			// Trigger event on the 'events' channel
			await this.pusher.trigger("events", eventType, data);
			console.log(`[Pusher] Broadcast ${eventType}`);
		} catch (error) {
			console.error(`[Pusher] Error broadcasting ${eventType}:`, error);
		}
	}

	/**
	 * Get number of connected clients (not directly available with Pusher)
	 * Returns null as Pusher manages this internally
	 */
	getClientCount() {
		return null;
	}
}

// Singleton instance with HMR support
if (!global.pusherBroadcaster) {
	global.pusherBroadcaster = new PusherBroadcaster();
	console.log("[Pusher] Broadcaster singleton created");
}

const broadcaster = global.pusherBroadcaster;

export default broadcaster;
