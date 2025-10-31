import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { Proposal } from "../../lib/models";
import { ensureActiveSession } from "../../lib/session-helper";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			// Get active session
			const activeSession = await ensureActiveSession();
			if (!activeSession) {
				return res.status(200).json([]);
			}

			// Get all proposals for current session
			const proposals = await Proposal.find({
				sessionId: activeSession._id
			}).sort({ createdAt: -1 }).lean();

			return res.status(200).json(proposals.map((p) => ({
				_id: p._id.toString(),
				sessionId: p.sessionId?.toString(),
				title: p.title,
				description: p.description,
				problem: p.problem,
				solution: p.solution,
				estimatedCost: p.estimatedCost,
				status: p.status,
				thumbsUpCount: p.thumbsUpCount || 0,
				averageRating: p.averageRating || 0,
				ratingsCount: p.ratingsCount || 0,
				yesVotes: p.yesVotes || 0,
				noVotes: p.noVotes || 0,
				authorId: p.authorId?.toString(),
				authorName: p.authorName,
				createdAt: p.createdAt,
			})));
		} catch (error) {
			console.error("Error fetching proposals:", error);
			return res.status(500).json({ error: "Failed to fetch proposals" });
		}
	}

	if (req.method === "POST") {
		try {
			const { title, problem, solution, estimatedCost } = req.body;

			if (!title || !problem || !solution) {
				return res.status(400).json({ error: "Title, problem, and solution are required" });
			}

			// Get active session
			const activeSession = await ensureActiveSession();
			if (!activeSession) {
				return res.status(400).json({ error: "No active session" });
			}

			// Create proposal
			const proposal = await Proposal.create({
				sessionId: activeSession._id,
				title,
				description: `${problem}\n\n${solution}`, // Legacy field
				problem,
				solution,
				estimatedCost: estimatedCost || "Unknown",
				status: "active",
				authorId: session.user.id,
				authorName: session.user.name,
				thumbsUpCount: 0,
				averageRating: 0,
				ratingsCount: 0,
			});

			// Broadcast new proposal event to all connected clients
			broadcaster.broadcast('new-proposal', {
				_id: proposal._id.toString(),
				sessionId: proposal.sessionId.toString(),
				title: proposal.title,
				problem: proposal.problem,
				solution: proposal.solution,
				estimatedCost: proposal.estimatedCost,
				status: proposal.status,
				thumbsUpCount: 0,
				averageRating: 0,
				ratingsCount: 0,
				authorId: proposal.authorId.toString(),
				authorName: proposal.authorName,
				createdAt: proposal.createdAt,
			});

			return res.status(201).json({
				_id: proposal._id.toString(),
				message: "Proposal created successfully"
			});
		} catch (error) {
			console.error("Error creating proposal:", error);
			return res.status(500).json({ error: "Failed to create proposal" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
