/**
 * Server-Sent Events (SSE) Broadcaster
 * Manages SSE connections and broadcasts events to all connected clients
 */

class SSEBroadcaster {
	constructor() {
		this.clients = new Map(); // Map of clientId -> response object
		this.nextClientId = 1;
	}

	/**
	 * Add a new SSE client connection
	 * @param {Object} res - Response object
	 * @returns {number} clientId
	 */
	addClient(res) {
		const clientId = this.nextClientId++;
		this.clients.set(clientId, res);

		console.log(`[SSE] Client ${clientId} connected. Total clients: ${this.clients.size}`);

		// Setup cleanup on connection close
		res.on('close', () => {
			this.removeClient(clientId);
		});

		return clientId;
	}

	/**
	 * Remove a client connection
	 * @param {number} clientId
	 */
	removeClient(clientId) {
		this.clients.delete(clientId);
		console.log(`[SSE] Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
	}

	/**
	 * Broadcast an event to all connected clients
	 * @param {string} eventType - Type of event (e.g., 'new-proposal', 'phase-change')
	 * @param {Object} data - Event data
	 */
	broadcast(eventType, data) {
		const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

		console.log(`[SSE] Broadcasting ${eventType} to ${this.clients.size} clients`);

		// Send to all connected clients
		for (const [clientId, res] of this.clients.entries()) {
			try {
				res.write(message);
			} catch (error) {
				console.error(`[SSE] Error sending to client ${clientId}:`, error);
				this.removeClient(clientId);
			}
		}
	}

	/**
	 * Send heartbeat to keep connections alive
	 */
	sendHeartbeat() {
		for (const [clientId, res] of this.clients.entries()) {
			try {
				res.write(':\n\n'); // Comment = heartbeat
			} catch (error) {
				console.error(`[SSE] Error sending heartbeat to client ${clientId}:`, error);
				this.removeClient(clientId);
			}
		}
	}

	/**
	 * Get number of connected clients
	 */
	getClientCount() {
		return this.clients.size;
	}
}

// Singleton instance
const broadcaster = new SSEBroadcaster();

// Send heartbeat every 30 seconds to keep connections alive
setInterval(() => {
	broadcaster.sendHeartbeat();
}, 30000);

export default broadcaster;
