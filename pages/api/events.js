import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import broadcaster from "../../lib/sse-broadcaster";

/**
 * SSE endpoint for real-time updates
 * Clients connect to this endpoint to receive real-time events
 */
export default async function handler(req, res) {
	// Only allow GET requests
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// Check authentication
	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	// Setup SSE headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive',
		'X-Accel-Buffering': 'no', // Disable buffering in nginx
	});

	// Send initial connection message
	res.write(`event: connected\ndata: ${JSON.stringify({ message: "Connected to SSE" })}\n\n`);

	// Add client to broadcaster
	const clientId = broadcaster.addClient(res);

	console.log(`[SSE] User ${session.user.name} (${session.user.id}) connected as client ${clientId}`);

	// Keep connection alive (Next.js will handle the connection)
	// The connection will be closed when the client disconnects
}
