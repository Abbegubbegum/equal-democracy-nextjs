import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Pusher from "pusher-js";

/**
 * Custom hook for Pusher real-time events
 * Automatically connects to Pusher and listens for real-time updates
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
 * @param {Function} handlers.onConnected - Called when connection is established
 * @param {Function} handlers.onError - Called when an error occurs
 */
export default function useSSE(handlers = {}) {
	const { data: session, status } = useSession();
	const pusherRef = useRef(null);
	const channelRef = useRef(null);
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

		// Get Pusher config from environment variables
		const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
		const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

		if (!pusherKey || !pusherCluster) {
			console.error(
				"[Pusher] Missing NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER"
			);
			return;
		}

		// Create Pusher connection
		console.log("[Pusher] Connecting to Pusher...");
		const pusher = new Pusher(pusherKey, {
			cluster: pusherCluster,
		});

		pusherRef.current = pusher;

		// Subscribe to the events channel
		const channel = pusher.subscribe("events");
		channelRef.current = channel;

		// Connection state events
		pusher.connection.bind("connected", () => {
			console.log("[Pusher] Connected to Pusher");
			if (handlersRef.current.onConnected) {
				handlersRef.current.onConnected({
					message: "Connected to Pusher",
				});
			}
		});

		pusher.connection.bind("error", (error) => {
			console.error("[Pusher] Connection error:", error);
			if (handlersRef.current.onError) {
				handlersRef.current.onError(error);
			}
		});

		// Listen for new proposals
		channel.bind("new-proposal", (data) => {
			console.log("[Pusher] New proposal received");
			if (handlersRef.current.onNewProposal) {
				handlersRef.current.onNewProposal(data);
			}
		});

		// Listen for new comments
		channel.bind("new-comment", (data) => {
			console.log("[Pusher] New comment received");
			if (handlersRef.current.onNewComment) {
				handlersRef.current.onNewComment(data);
			}
		});

		// Listen for vote updates
		channel.bind("vote-update", (data) => {
			console.log("[Pusher] Vote update received");
			if (handlersRef.current.onVoteUpdate) {
				handlersRef.current.onVoteUpdate(data);
			}
		});

		// Listen for rating updates
		channel.bind("rating-update", (data) => {
			console.log("[Pusher] Rating update received");
			if (handlersRef.current.onRatingUpdate) {
				handlersRef.current.onRatingUpdate(data);
			}
		});

		// Listen for comment rating updates
		channel.bind("comment-rating-update", (data) => {
			console.log("[Pusher] Comment rating update received");
			if (handlersRef.current.onCommentRatingUpdate) {
				handlersRef.current.onCommentRatingUpdate(data);
			}
		});

		// Listen for phase changes
		channel.bind("phase-change", (data) => {
			console.log("[Pusher] Phase change received");
			if (handlersRef.current.onPhaseChange) {
				handlersRef.current.onPhaseChange(data);
			}
		});

		// Listen for transition scheduled
		channel.bind("transition-scheduled", (data) => {
			console.log("[Pusher] Transition scheduled");
			if (handlersRef.current.onTransitionScheduled) {
				handlersRef.current.onTransitionScheduled(data);
			}
		});

		// Listen for new sessions
		channel.bind("new-session", (data) => {
			console.log("[Pusher] New session created");
			if (handlersRef.current.onNewSession) {
				handlersRef.current.onNewSession(data);
			}
		});

		// Cleanup on unmount
		return () => {
			console.log("[Pusher] Disconnecting from Pusher");
			if (channelRef.current) {
				channelRef.current.unbind_all();
				pusher.unsubscribe("events");
			}
			if (pusherRef.current) {
				pusherRef.current.disconnect();
			}
		};
	}, [session, status]);

	// Return a function to manually close the connection if needed
	return {
		close: () => {
			if (channelRef.current) {
				channelRef.current.unbind_all();
				pusherRef.current?.unsubscribe("events");
			}
			if (pusherRef.current) {
				pusherRef.current.disconnect();
			}
		},
	};
}
