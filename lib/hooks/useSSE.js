import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * Custom hook for Server-Sent Events (SSE) connection
 * Automatically connects to /api/events and listens for real-time updates
 *
 * @param {Object} handlers - Object with event handlers
 * @param {Function} handlers.onNewProposal - Called when a new proposal is created
 * @param {Function} handlers.onNewComment - Called when a new comment is added
 * @param {Function} handlers.onVoteUpdate - Called when votes are cast
 * @param {Function} handlers.onRatingUpdate - Called when proposal ratings change
 * @param {Function} handlers.onCommentRatingUpdate - Called when comment ratings change
 * @param {Function} handlers.onPhaseChange - Called when session phase changes
 * @param {Function} handlers.onTransitionScheduled - Called when phase transition is scheduled
 * @param {Function} handlers.onNewSession - Called when a new session is created
 * @param {Function} handlers.onConnected - Called when SSE connection is established
 * @param {Function} handlers.onError - Called when an error occurs
 */
export default function useSSE(handlers = {}) {
	const { data: session, status } = useSession();
	const eventSourceRef = useRef(null);
	const handlersRef = useRef(handlers);

	// Update handlers ref when handlers change
	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	useEffect(() => {
		// Only connect if user is authenticated
		if (status !== "authenticated" || !session) {
			return;
		}

		// Create EventSource connection
		console.log("[SSE] Connecting to SSE endpoint...");
		const eventSource = new EventSource("/api/events");
		eventSourceRef.current = eventSource;

		// Connection opened
		eventSource.addEventListener("connected", (e) => {
			console.log("[SSE] Connected to server");
			const data = JSON.parse(e.data);
			if (handlersRef.current.onConnected) {
				handlersRef.current.onConnected(data);
			}
		});

		// Listen for new proposals
		eventSource.addEventListener("new-proposal", (e) => {
			console.log("[SSE] New proposal received");
			const proposal = JSON.parse(e.data);
			if (handlersRef.current.onNewProposal) {
				handlersRef.current.onNewProposal(proposal);
			}
		});

		// Listen for new comments
		eventSource.addEventListener("new-comment", (e) => {
			console.log("[SSE] New comment received");
			const comment = JSON.parse(e.data);
			if (handlersRef.current.onNewComment) {
				handlersRef.current.onNewComment(comment);
			}
		});

		// Listen for vote updates
		eventSource.addEventListener("vote-update", (e) => {
			console.log("[SSE] Vote update received");
			const voteData = JSON.parse(e.data);
			if (handlersRef.current.onVoteUpdate) {
				handlersRef.current.onVoteUpdate(voteData);
			}
		});

		// Listen for rating updates
		eventSource.addEventListener("rating-update", (e) => {
			console.log("[SSE] Rating update received");
			const ratingData = JSON.parse(e.data);
			if (handlersRef.current.onRatingUpdate) {
				handlersRef.current.onRatingUpdate(ratingData);
			}
		});

		// Listen for comment rating updates
		eventSource.addEventListener("comment-rating-update", (e) => {
			console.log("[SSE] Comment rating update received");
			const commentRatingData = JSON.parse(e.data);
			if (handlersRef.current.onCommentRatingUpdate) {
				handlersRef.current.onCommentRatingUpdate(commentRatingData);
			}
		});

		// Listen for phase changes
		eventSource.addEventListener("phase-change", (e) => {
			console.log("[SSE] Phase change received");
			const phaseData = JSON.parse(e.data);
			if (handlersRef.current.onPhaseChange) {
				handlersRef.current.onPhaseChange(phaseData);
			}
		});

		// Listen for transition scheduled
		eventSource.addEventListener("transition-scheduled", (e) => {
			console.log("[SSE] Transition scheduled");
			const transitionData = JSON.parse(e.data);
			if (handlersRef.current.onTransitionScheduled) {
				handlersRef.current.onTransitionScheduled(transitionData);
			}
		});

		// Listen for new sessions
		eventSource.addEventListener("new-session", (e) => {
			console.log("[SSE] New session created");
			const sessionData = JSON.parse(e.data);
			if (handlersRef.current.onNewSession) {
				handlersRef.current.onNewSession(sessionData);
			}
		});

		// Handle errors
		eventSource.onerror = (error) => {
			console.error("[SSE] Connection error:", error);
			if (handlersRef.current.onError) {
				handlersRef.current.onError(error);
			}
			// EventSource will automatically attempt to reconnect
		};

		// Cleanup on unmount
		return () => {
			console.log("[SSE] Disconnecting from SSE endpoint");
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		};
	}, [session, status]);

	// Return a function to manually close the connection if needed
	return {
		close: () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		}
	};
}
