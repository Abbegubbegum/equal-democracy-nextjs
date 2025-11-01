import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import {
	Users,
	Plus,
	ThumbsUp,
	ThumbsDown,
	MessageCircle,
	TrendingUp,
	Info,
	Clock,
	Star,
	AlertCircle,
} from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";
import useSSE from "../lib/hooks/useSSE";

// Helper function to format date and time consistently
function formatDateTime(dateString) {
	const date = new Date(dateString);
	const year = date.getFullYear().toString().slice(2);
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${year}${month}${day}, ${hours}:${minutes}`;
}

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	const { config } = useConfig();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("home"); // 'home', 'create', 'vote'
	const [selectedProposal, setSelectedProposal] = useState(null);
	const [placeName, setPlaceName] = useState("");
	const [currentPhase, setCurrentPhase] = useState("phase1"); // 'phase1', 'phase2', 'closed'
	const [expandedRating, setExpandedRating] = useState(null); // proposalId currently showing star rating
	const [expandedProposal, setExpandedProposal] = useState(null); // proposalId currently showing arguments
	const [userHasRated, setUserHasRated] = useState(false); // Has user rated at least one proposal
	const [showPhaseTransition, setShowPhaseTransition] = useState(false); // Show transition modal
	const [showSessionClosed, setShowSessionClosed] = useState(false); // Show session closed modal
	const [winningProposals, setWinningProposals] = useState([]); // Winning proposals with yes-majority
	const [transitionCountdown, setTransitionCountdown] = useState(null); // Countdown seconds for phase transition
	const [userHasVotedInSession, setUserHasVotedInSession] = useState(false); // Has user used their one vote
	const [votedProposalId, setVotedProposalId] = useState(null); // Which proposal user voted on
	const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is the first session info fetch
	const [hasActiveSession, setHasActiveSession] = useState(true); // Track if there is an active session
	const transitionIntervalRef = useRef(null); // Reference to transition checking interval
	const [commentUpdateTrigger, setCommentUpdateTrigger] = useState(0); // Trigger for comment updates
	const [userHasCreatedProposal, setUserHasCreatedProposal] = useState(false); // Track if user has created a proposal

	// Setup SSE for real-time updates
	useSSE({
		onNewProposal: (proposal) => {
			console.log("New proposal received, updating list");
			setProposals((prev) => [proposal, ...prev]);
		},
		onNewComment: (comment) => {
			console.log(
				"New comment received for proposal:",
				comment.proposalId
			);
			// Trigger comment refresh for the specific proposal
			setCommentUpdateTrigger((prev) => prev + 1);
		},
		onCommentRatingUpdate: (commentRatingData) => {
			console.log(
				"Comment rating update for comment:",
				commentRatingData.commentId
			);
			// Trigger comment refresh to show updated ratings
			setCommentUpdateTrigger((prev) => prev + 1);
		},
		onVoteUpdate: (voteData) => {
			console.log(
				"Vote update received for proposal:",
				voteData.proposalId
			);
			// Update the specific proposal's vote counts
			setProposals((prev) =>
				prev.map((p) =>
					p._id === voteData.proposalId
						? { ...p, yesVotes: voteData.yes, noVotes: voteData.no }
						: p
				)
			);
		},
		onRatingUpdate: (ratingData) => {
			console.log(
				"Rating update received for proposal:",
				ratingData.proposalId
			);
			// Update the specific proposal's rating
			setProposals((prev) =>
				prev.map((p) =>
					p._id === ratingData.proposalId
						? {
								...p,
								thumbsUpCount: ratingData.thumbsUpCount,
								averageRating: ratingData.averageRating,
						  }
						: p
				)
			);
		},
		onPhaseChange: async (phaseData) => {
			console.log("Phase change received:", phaseData.phase);
			setCurrentPhase(phaseData.phase);

			// If session is closed, show results modal
			if (phaseData.phase === "closed" && !showSessionClosed) {
				await fetchWinningProposals();
				setShowSessionClosed(true);
			}
		},
		onTransitionScheduled: (transitionData) => {
			console.log(
				"Transition scheduled, countdown:",
				transitionData.secondsRemaining
			);
			// Start the countdown timer for all connected clients
			setTransitionCountdown(transitionData.secondsRemaining);
			checkPhaseTransition(); // This will start the countdown polling
		},
		onNewSession: async (sessionData) => {
			console.log("New session created:", sessionData.place);
			// Update place name
			setPlaceName(sessionData.place);
			// Clear old data and refresh
			setProposals([]);
			setHasActiveSession(true);
			setCurrentPhase("phase1");
			setShowSessionClosed(false);
			// Fetch fresh data
			await fetchSessionInfo();
			await fetchProposals();
		},
		onConnected: () => {
			console.log("Successfully connected to real-time updates");
		},
		onError: (error) => {
			console.error("Connection error, will auto-reconnect:", error);
		},
	});

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	useEffect(() => {
		if (session) {
			fetchProposals();
			fetchSessionInfo();
			checkUserVote(); // Check if user has already voted
		}
	}, [session]);

	// Check if user has created a proposal
	useEffect(() => {
		if (session && proposals.length > 0) {
			const hasCreated = proposals.some(
				(p) => p.authorId === session.user.id
			);
			setUserHasCreatedProposal(hasCreated);
		}
	}, [proposals, session]);

	// Light polling as backup (SSE handles most real-time updates)
	// This ensures data consistency if SSE connection temporarily fails
	useEffect(() => {
		if (!session || !currentPhase) {
			return;
		}

		// Poll every 60 seconds as a safety net
		// SSE will handle immediate updates, this is just for reliability
		const pollInterval = setInterval(() => {
			fetchSessionInfo();
			// Only fetch proposals if we're in an active phase
			if (currentPhase !== "closed") {
				fetchProposals();
			}
		}, 60000); // Check every minute

		return () => {
			clearInterval(pollInterval);
			// Clear transition interval when component unmounts
			if (transitionIntervalRef.current) {
				clearInterval(transitionIntervalRef.current);
				transitionIntervalRef.current = null;
			}
		};
	}, [session, currentPhase]);

	const fetchSessionInfo = async () => {
		try {
			const res = await fetch("/api/sessions/current");
			const data = await res.json();

			// Check if there's no active session
			if (data.noActiveSession) {
				setHasActiveSession(false);
				setCurrentPhase(null);
				setPlaceName("");
				return;
			}

			// Active session exists
			setHasActiveSession(true);

			// Set place name from session
			if (data.place) {
				setPlaceName(data.place);
			}

			if (data.phase) {
				const previousPhase = currentPhase;

				// Show results modal if session is closed and we haven't shown it yet
				// This covers both: users on the page when it closes, and users loading after it's closed
				if (data.phase === "closed" && !showSessionClosed) {
					await fetchWinningProposals();
					setShowSessionClosed(true);
				}

				setCurrentPhase(data.phase);

				// Mark that initial load is complete
				if (isInitialLoad) {
					setIsInitialLoad(false);
				}
			}
		} catch (error) {
			console.error("Error fetching session info:", error);
		}
	};

	const fetchWinningProposals = async () => {
		try {
			const res = await fetch("/api/top-proposals");
			const data = await res.json();
			setWinningProposals(data);
		} catch (error) {
			console.error("Error fetching winning proposals:", error);
		}
	};

	const checkUserVote = async () => {
		try {
			const res = await fetch("/api/votes?checkSession=true");
			if (!res.ok) {
				console.error("Error checking user vote:", res.status);
				return;
			}
			const data = await res.json();
			setUserHasVotedInSession(data.hasVotedInSession);
			setVotedProposalId(data.votedProposalId);
		} catch (error) {
			console.error("Error checking user vote:", error);
		}
	};

	const fetchProposals = async () => {
		try {
			const res = await fetch("/api/proposals");
			const data = await res.json();
			// Ensure data is always an array
			setProposals(Array.isArray(data) ? data : []);
		} catch (error) {
			console.error("Error fetching proposals:", error);
			setProposals([]); // Set empty array on error
		} finally {
			setLoading(false);
		}
	};

	const handleCreateProposal = async (
		title,
		problem,
		solution,
		estimatedCost
	) => {
		try {
			const res = await fetchWithCsrf("/api/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					problem,
					solution,
					estimatedCost,
				}),
			});

			if (res.ok) {
				// Don't fetch proposals - Pusher will broadcast the new proposal to all clients
				// This prevents the creator from seeing their proposal twice
				setUserHasCreatedProposal(true);
				setView("home");
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error creating proposal:", error);
			alert("Ett fel uppstod vid skapande av förslag");
		}
	};

	const handleThumbsUp = async (proposalId, rating = 5) => {
		// Gentle nudge if user hasn't created their own proposal yet
		if (!userHasCreatedProposal) {
			const shouldContinue = confirm(
				t("rating.createProposalNudge") ||
					"Have you considered creating your own proposal first? You can always rate others afterward."
			);
			if (!shouldContinue) {
				return; // User wants to create a proposal first
			}
		}

		try {
			const res = await fetchWithCsrf("/api/thumbsup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, rating }),
			});

			if (res.ok) {
				// Don't fetch proposals - Pusher will broadcast the rating update to all clients
				setExpandedRating(null); // Collapse after rating
				setUserHasRated(true); // Mark that user has rated at least one proposal

				// Check if we should auto-transition to phase 2
				checkPhaseTransition();
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error voting:", error);
		}
	};

	const checkPhaseTransition = async () => {
		try {
			const res = await fetch("/api/sessions/check-phase-transition");
			const data = await res.json();

			if (data.transitionScheduled) {
				// Transition is scheduled, show countdown
				setTransitionCountdown(data.secondsRemaining);

				// Clear any existing interval before starting a new one
				if (transitionIntervalRef.current) {
					clearInterval(transitionIntervalRef.current);
					transitionIntervalRef.current = null;
				}

				// Start polling for execution
				transitionIntervalRef.current = setInterval(async () => {
					const execRes = await fetchWithCsrf(
						"/api/sessions/execute-scheduled-transition",
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
						}
					);

					if (execRes.ok) {
						const execData = await execRes.json();

						if (execData.transitionExecuted) {
							// Transition complete!
							if (transitionIntervalRef.current) {
								clearInterval(transitionIntervalRef.current);
								transitionIntervalRef.current = null;
							}
							setTransitionCountdown(null);
							setShowPhaseTransition(true);

							// Update session info after delay
							setTimeout(() => {
								fetchSessionInfo();
								fetchProposals();
								setShowPhaseTransition(false);
							}, 3000);
						} else if (execData.secondsRemaining !== undefined) {
							// Update countdown
							setTransitionCountdown(execData.secondsRemaining);
						}
					}
				}, 1000); // Check every second

				// Clear interval after 110 seconds (safety)
				setTimeout(() => {
					if (transitionIntervalRef.current) {
						clearInterval(transitionIntervalRef.current);
						transitionIntervalRef.current = null;
					}
				}, 110000);
			}
		} catch (error) {
			console.error("Error checking phase transition:", error);
		}
	};

	const handleAddComment = async (proposalId, text, type = "neutral") => {
		try {
			const res = await fetchWithCsrf("/api/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, text, type }),
			});

			if (res.ok) {
				// Don't fetch proposals - Pusher will broadcast the new comment to all clients
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error adding comment:", error);
		}
	};

	const handleFinalVote = async (proposalId, choice) => {
		try {
			const res = await fetchWithCsrf("/api/votes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, choice }),
			});

			if (res.ok) {
				const data = await res.json();

				// Update user vote status
				setUserHasVotedInSession(true);
				setVotedProposalId(proposalId);

				// Don't fetch proposals - Pusher will broadcast the vote update to all clients

				// Check if session was auto-closed
				if (data.sessionClosed) {
					await fetchWinningProposals();
					await fetchSessionInfo();
					setShowSessionClosed(true);
				}
			} else {
				// Try to parse error message, but handle case where response is not JSON
				try {
					const data = await res.json();
					alert(data.message || "Ett fel uppstod vid röstning");
				} catch (jsonError) {
					alert("Ett fel uppstod vid röstning");
				}
			}
		} catch (error) {
			console.error("Error voting:", error);
			alert("Ett fel uppstod vid röstning");
		}
	};

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="text-xl text-gray-600">Laddar...</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	// Phase transition modal
	if (showPhaseTransition) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div className="bg-white rounded-3xl p-12 max-w-lg mx-4 text-center shadow-2xl animate-fade-in">
					<div className="text-6xl mb-6">🎉</div>
					<h2 className="text-3xl font-bold text-primary-800 mb-4">
						{t("phases.ideaPhaseComplete")}
					</h2>
					<p className="text-xl text-gray-700">
						{t("phases.nowToDebateAndVoting")}
					</p>
				</div>
			</div>
		);
	}

	// Session closed modal
	if (showSessionClosed) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
					<div className="text-center mb-6">
						<div className="text-6xl mb-4">✅</div>
						<h2 className="text-3xl font-bold text-primary-800 mb-4">
							{t("voting.votingClosed")}
						</h2>
						<p className="text-xl text-gray-700 mb-6">
							{t("voting.weHaveResult")}
						</p>
					</div>

					{winningProposals.length > 0 ? (
						<div className="space-y-4 mb-8">
							{winningProposals.map((proposal, index) => (
								<div
									key={proposal._id}
									className="bg-green-50 border-2 border-green-500 rounded-2xl p-6"
								>
									<div className="flex items-start gap-3">
										<div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
											<span className="text-white font-bold text-lg">
												{index + 1}
											</span>
										</div>
										<div className="flex-1">
											<h3 className="text-xl font-bold text-green-800 mb-2">
												{proposal.title}
											</h3>
											<div className="space-y-2 text-sm">
												<div>
													<p className="font-semibold text-gray-700">
														{t(
															"proposals.problemColon"
														)}
													</p>
													<p className="text-gray-600">
														{proposal.problem}
													</p>
												</div>
												<div>
													<p className="font-semibold text-gray-700">
														{t(
															"proposals.solutionColon"
														)}
													</p>
													<p className="text-gray-600">
														{proposal.solution}
													</p>
												</div>
												<div className="flex gap-4 mt-3 text-sm">
													<span className="bg-green-200 text-green-800 px-3 py-1 rounded-full font-semibold">
														{t("voting.yes")}:{" "}
														{proposal.yesVotes}
													</span>
													<span className="bg-red-200 text-red-800 px-3 py-1 rounded-full font-semibold">
														{t("voting.no")}:{" "}
														{proposal.noVotes}
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="bg-gray-100 rounded-2xl p-8 text-center mb-8">
							<p className="text-gray-600">
								{t("voting.noMajority")}
							</p>
						</div>
					)}

					<div className="text-center">
						<p className="text-xl font-semibold text-primary-800 mb-4">
							{t("voting.thanksForParticipation")}
						</p>
						<button
							onClick={() => {
								setShowSessionClosed(false);
								setView("home");
								// Update state to reflect no active session
								setHasActiveSession(false);
								setCurrentPhase(null);
								setProposals([]);
							}}
							className="bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md"
						>
							{t("common.close")}
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Render different views
	if (view === "create") {
		return (
			<CreateProposalView
				onSubmit={handleCreateProposal}
				onBack={() => setView("home")}
				t={t}
			/>
		);
	}

	// Debate view removed - users now click directly on proposals to debate

	if (view === "vote") {
		const topProposals = proposals.filter((p) => p.status === "top3");
		return (
			<VoteView
				proposals={topProposals}
				currentUser={session.user}
				onVote={handleFinalVote}
				onBack={() => setView("home")}
				t={t}
			/>
		);
	}

	// Home view
	// In Phase 1: show active proposals, sorted by creation time (newest first)
	// In Phase 2: show top proposals (40%), sorted by rating (highest first)
	const activeProposals = proposals
		.filter((p) => p.status === "active")
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	const topProposals = proposals
		.filter((p) => p.status === "top3")
		.sort((a, b) => {
			// Sort by average rating first, then by thumbs up count
			if (b.averageRating !== a.averageRating) {
				return (b.averageRating || 0) - (a.averageRating || 0);
			}
			return b.thumbsUpCount - a.thumbsUpCount;
		});

	// Display proposals based on phase
	const displayProposals =
		currentPhase === "phase1" ? activeProposals : topProposals;

	// Get theme colors
	const { theme } = useConfig();
	const primaryColor = theme.colors.primary[600] || "#2563eb";
	const accentColor = theme.colors.accent[400] || "#facc15";
	const primaryDark = theme.colors.primary[800] || "#1e40af";

	return (
		<div className="min-h-screen bg-gray-50">
			<div
				className="text-white p-6 shadow-lg"
				style={{
					background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
				}}
			>
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div
								className="w-12 h-12 rounded-full flex items-center justify-center"
								style={{ backgroundColor: accentColor }}
							>
								<Users
									className="w-6 h-6"
									style={{ color: primaryDark }}
								/>
							</div>
							<div>
								<h1 className="text-2xl font-bold">
									{t("appName")}
								</h1>
								<p className="text-primary-100 text-sm">
									{t("auth.hello")}, {session.user.name}!
								</p>
							</div>
						</div>
						<div className="flex items-center gap-4">
							{session.user.isAdmin && (
								<button
									onClick={() => router.push("/admin")}
									className="text-white hover:text-accent-400 text-sm font-medium"
								>
									{t("nav.admin")}
								</button>
							)}
							<button
								onClick={() => router.push("/dashboard")}
								className="text-white hover:text-accent-400 text-sm font-medium"
							>
								{t("nav.myActivity")}
							</button>
							<button
								onClick={() => signOut()}
								className="text-white hover:text-accent-400 text-sm"
							>
								{t("auth.logout")}
							</button>
						</div>
					</div>
					<h2 className="text-xl font-medium">
						{hasActiveSession && placeName
							? `${t("proposals.howToImprove")} ${placeName}?`
							: t("proposals.howToImproveYourSpace")}
					</h2>
				</div>
			</div>

			<div className="max-w-4xl mx-auto p-6 space-y-6">
				{/* Show "No active session" button when there's no active session */}
				{!hasActiveSession && (
					<button
						disabled
						className="w-full font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 cursor-not-allowed opacity-75"
						style={{
							backgroundColor: accentColor,
							color: primaryDark,
						}}
					>
						<AlertCircle className="w-6 h-6" />
						{t("proposals.noActiveSession")}
					</button>
				)}

				{/* Only allow new proposals in Phase 1 AND when countdown hasn't started AND session exists */}
				{hasActiveSession &&
					currentPhase === "phase1" &&
					transitionCountdown === null && (
						<button
							onClick={() => setView("create")}
							className="w-full font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
							style={{
								backgroundColor: accentColor,
								color: primaryDark,
							}}
						>
							<Plus className="w-6 h-6" />
							{t("proposals.proposeNewIdea")}
						</button>
					)}

				{/* Countdown banner for phase transition */}
				{transitionCountdown !== null && currentPhase === "phase1" && (
					<div className="bg-gradient-to-r from-accent-100 to-accent-50 border-2 border-accent-400 rounded-2xl p-6 shadow-md">
						<div className="flex items-center justify-center gap-3">
							<Clock className="w-6 h-6 text-accent-600 animate-pulse" />
							<p className="text-center text-lg font-semibold text-accent-800">
								{t("phases.transitionToDebate")}{" "}
								<span className="text-2xl font-bold text-accent-900">
									{transitionCountdown}
								</span>{" "}
								{t("common.seconds")}...
							</p>
						</div>
						<p className="text-center text-sm text-accent-700 mt-2">
							{t("phases.transitionMessage")}
						</p>
					</div>
				)}

				{/* Information about limited voting rights in Phase 2 */}
				{currentPhase === "phase2" && !userHasVotedInSession && (
					<div className="bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-400 rounded-2xl p-6 shadow-md">
						<div className="flex items-start gap-4">
							<div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center shrink-0">
								<Info className="w-6 h-6 text-white" />
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-bold text-primary-900 mb-2">
									{t("voting.limitedVotingRights")}
								</h3>
								<p className="text-gray-700 text-sm leading-relaxed mb-2">
									{t("voting.oneVotePerSession")}
								</p>
								<p className="text-gray-700 text-sm leading-relaxed">
									{t("voting.votingAdvantages")}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* User has voted - show confirmation */}
				{currentPhase === "phase2" && userHasVotedInSession && (
					<div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-6 shadow-md">
						<div className="flex items-center justify-center gap-3">
							<div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
								<span className="text-2xl text-white">✓</span>
							</div>
							<div className="text-center">
								<h3 className="text-lg font-bold text-green-900">
									{t("voting.thanksForVote")}
								</h3>
								<p className="text-gray-700 text-sm">
									{t("voting.sessionClosesWhen")}
								</p>
							</div>
						</div>
					</div>
				)}

				{topProposals.length > 0 && (
					<div className="bg-accent-50 border-2 border-accent-400 rounded-2xl p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TrendingUp className="w-6 h-6 text-accent-600" />
								<h3 className="text-xl font-bold text-primary-800">
									{t("proposals.topProposals")}
								</h3>
							</div>
							<button
								onClick={() => setView("vote")}
								className="bg-primary-800 hover:bg-primary-900 text-white px-4 py-2 rounded-lg font-medium"
							>
								{t("proposals.vote")}
							</button>
						</div>
						<p className="text-gray-700">
							{t("proposals.clickToDebateAndVote")}
						</p>
					</div>
				)}

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
						<MessageCircle className="w-5 h-5" />
						{currentPhase === "phase1"
							? t("proposals.allProposalsCount", {
									count: displayProposals.length,
							  })
							: t("proposals.topProposalsCount", {
									count: displayProposals.length,
							  })}
					</h3>

					{displayProposals.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								{currentPhase === "phase1"
									? t("proposals.noProposals")
									: t("proposals.noTopProposals")}
							</p>
						</div>
					) : (
						displayProposals.map((proposal) => (
							<ProposalCard
								key={proposal._id}
								proposal={proposal}
								currentUser={session.user}
								currentPhase={currentPhase}
								expandedRating={expandedRating}
								setExpandedRating={setExpandedRating}
								expandedProposal={expandedProposal}
								setExpandedProposal={setExpandedProposal}
								onThumbsUp={handleThumbsUp}
								onAddComment={handleAddComment}
								onVote={() => setView("vote")}
								userHasVotedInSession={userHasVotedInSession}
								votedProposalId={votedProposalId}
								commentUpdateTrigger={commentUpdateTrigger}
								t={t}
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// PROPOSAL CARD COMPONENT
// ============================================================================

function ProposalCard({
	proposal,
	currentUser,
	currentPhase,
	expandedRating,
	setExpandedRating,
	expandedProposal,
	setExpandedProposal,
	onThumbsUp,
	onAddComment,
	onVote,
	userHasVotedInSession,
	votedProposalId,
	commentUpdateTrigger,
	t,
}) {
	const [hasVoted, setHasVoted] = useState(false);
	const [checking, setChecking] = useState(true);
	const [userRating, setUserRating] = useState(0);
	const [confirmedRating, setConfirmedRating] = useState(0);
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [comments, setComments] = useState([]);
	const [loadingComments, setLoadingComments] = useState(false);
	const [commentText, setCommentText] = useState("");
	const [commentType, setCommentType] = useState("neutral");
	const [submitting, setSubmitting] = useState(false);
	const [expandedCommentRating, setExpandedCommentRating] = useState(null); // For comment rating expansion
	const [commentRatings, setCommentRatings] = useState({}); // Store user ratings for comments

	const isExpanded = expandedRating === proposal._id;
	const isExpandedForDiscuss = expandedProposal === proposal._id;
	const isPhase1 = currentPhase === "phase1";

	useEffect(() => {
		checkIfVoted();
	}, [proposal._id]);

	useEffect(() => {
		if (isExpandedForDiscuss) {
			fetchComments();
		}
	}, [isExpandedForDiscuss]);

	// Refetch comments when commentUpdateTrigger changes (from SSE)
	useEffect(() => {
		if (isExpandedForDiscuss && commentUpdateTrigger > 0) {
			fetchComments();
		}
	}, [commentUpdateTrigger]);

	const checkIfVoted = async () => {
		try {
			const res = await fetch(`/api/thumbsup?proposalId=${proposal._id}`);
			const data = await res.json();
			setHasVoted(data.voted);
			setUserRating(data.rating || 0);
		} catch (error) {
			console.error("Error checking vote status:", error);
		} finally {
			setChecking(false);
		}
	};

	const fetchComments = async () => {
		setLoadingComments(true);
		try {
			const res = await fetch(`/api/comments?proposalId=${proposal._id}`);
			const data = await res.json();
			setComments(data);
		} catch (error) {
			console.error("Error fetching comments:", error);
		} finally {
			setLoadingComments(false);
		}
	};

	const handleStarClick = async (rating) => {
		setConfirmedRating(rating);
		setShowConfirmation(true);
		await onThumbsUp(proposal._id, rating);
		// Update local state to reflect that user has now voted
		setHasVoted(true);
		setUserRating(rating);
		setTimeout(() => {
			setShowConfirmation(false);
			setConfirmedRating(0);
		}, 1500);
	};

	const handleToggleDiscuss = () => {
		setExpandedProposal(isExpandedForDiscuss ? null : proposal._id);
	};

	const handleSubmitComment = async (e) => {
		e.preventDefault();
		if (commentText.trim()) {
			setSubmitting(true);
			await onAddComment(proposal._id, commentText.trim(), commentType);
			setCommentText("");
			setCommentType("neutral");
			await fetchComments();
			setSubmitting(false);
		}
	};

	const handleRateComment = async (commentId, rating) => {
		try {
			const res = await fetchWithCsrf("/api/comments/rate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ commentId, rating }),
			});

			if (res.ok) {
				const data = await res.json();
				// Update local state
				setCommentRatings({ ...commentRatings, [commentId]: rating });
				// Refresh comments to get updated averages
				await fetchComments();
				// Collapse rating UI after rating
				setExpandedCommentRating(null);
			}
		} catch (error) {
			console.error("Error rating comment:", error);
		}
	};

	const fetchCommentRating = async (commentId) => {
		try {
			const res = await fetch(
				`/api/comments/rate?commentId=${commentId}`
			);
			if (res.ok) {
				const data = await res.json();
				return data.userRating;
			}
		} catch (error) {
			console.error("Error fetching comment rating:", error);
		}
		return 0;
	};

	// Fetch user's ratings for all comments when comments load
	useEffect(() => {
		const fetchAllRatings = async () => {
			const ratings = {};
			for (const comment of comments) {
				const rating = await fetchCommentRating(comment._id);
				ratings[comment._id] = rating;
			}
			setCommentRatings(ratings);
		};
		if (comments.length > 0) {
			fetchAllRatings();
		}
	}, [comments.length]);

	return (
		<div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
			{/* Proposal header - clickable in Phase 2 */}
			<div
				className={
					!isPhase1
						? "cursor-pointer hover:bg-primary-50 -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl transition-all duration-200 hover:shadow-sm relative"
						: ""
				}
				onClick={!isPhase1 ? handleToggleDiscuss : undefined}
			>
				<h4
					className={`text-lg font-bold text-primary-800 mb-2 ${
						!isPhase1 ? "group-hover:text-primary-900" : ""
					}`}
				>
					{proposal.title}
				</h4>

				<div className="space-y-3 text-sm">
					<div>
						<p className="font-semibold text-gray-700">
							{t("proposals.problemColon")}
						</p>
						<p className="text-gray-600">{proposal.problem}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">
							{t("proposals.solutionColon")}
						</p>
						<p className="text-gray-600">{proposal.solution}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">
							{t("proposals.estimatedCost")}
						</p>
						<p className="text-gray-600">
							{proposal.estimatedCost}
						</p>
					</div>
				</div>

				{/* Show "Visa argument" indicator when collapsed in Phase 2 - inside clickable area */}
				{!isPhase1 && !isExpandedForDiscuss && (
					<div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-200 pointer-events-none">
						▼ {t("comments.showArguments")}
					</div>
				)}
			</div>

			{/* Phase 1: Expandable star rating */}
			{isPhase1 && (
				<div>
					<button
						onClick={() =>
							setExpandedRating(isExpanded ? null : proposal._id)
						}
						disabled={checking}
						className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
							hasVoted
								? "bg-primary-100 text-primary-600"
								: "bg-gray-100 hover:bg-primary-100 text-gray-700 hover:text-primary-600"
						}`}
					>
						<ThumbsUp className="w-5 h-5" />
						<span>
							{hasVoted
								? t("rating.changeRating")
								: t("rating.giveRating")}
						</span>
					</button>

					{/* Show user's current rating */}
					{hasVoted && userRating > 0 && !isExpanded && (
						<div className="mt-2 flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg">
							<span className="text-sm text-primary-800 font-medium">
								{t("rating.yourRating")}:
							</span>
							<div className="flex gap-0.5">
								{[1, 2, 3, 4, 5].map((star) => (
									<span key={star} className="text-lg">
										{star <= userRating ? "⭐" : "☆"}
									</span>
								))}
							</div>
						</div>
					)}

					{isExpanded && (
						<div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
							{[1, 2, 3, 4, 5].map((star) => {
								const isConfirmed =
									showConfirmation && star <= confirmedRating;
								return (
									<button
										key={star}
										onClick={() => handleStarClick(star)}
										className="text-3xl hover:scale-110 transition-transform"
										style={{
											color: isConfirmed
												? "#dc2626"
												: "inherit",
											filter: isConfirmed
												? "brightness(1.2)"
												: "none",
										}}
									>
										{isConfirmed
											? "⭐"
											: star <= userRating
											? "⭐"
											: "☆"}
									</button>
								);
							})}
							<span className="ml-2 text-sm text-gray-600">
								{showConfirmation
									? t("rating.ratingRegistered", {
											rating: confirmedRating,
									  })
									: t("rating.clickStar")}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Phase 2: Show rating */}
			{!isPhase1 && (
				<div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-100 text-primary-600 font-medium">
					<ThumbsUp className="w-5 h-5" />
					<span className="font-bold">{proposal.thumbsUpCount}</span>
					{proposal.averageRating > 0 && (
						<span className="ml-2">
							⭐ {proposal.averageRating.toFixed(1)}
						</span>
					)}
				</div>
			)}

			{/* Expanded discussion area for Phase 2 */}
			{!isPhase1 && isExpandedForDiscuss && (
				<div className="space-y-4 border-t pt-4">
					{/* Comment type selector */}
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setCommentType("neutral")}
							className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
								commentType === "neutral"
									? "bg-gray-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							{t("comments.neutral")}
						</button>
						<button
							type="button"
							onClick={() => setCommentType("for")}
							className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
								commentType === "for"
									? "bg-green-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							👍 {t("comments.for")}
						</button>
						<button
							type="button"
							onClick={() => setCommentType("against")}
							className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
								commentType === "against"
									? "bg-red-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							👎 {t("comments.against")}
						</button>
					</div>

					{/* Comment input */}
					<form onSubmit={handleSubmitComment} className="flex gap-2">
						<input
							type="text"
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none text-sm"
							placeholder={t("comments.writeArgument")}
							maxLength={1000}
						/>
						<button
							type="submit"
							disabled={!commentText.trim() || submitting}
							className="bg-primary-800 hover:bg-primary-900 disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm"
						>
							{submitting
								? t("comments.sending")
								: t("comments.send")}
						</button>
					</form>

					{/* Comments list */}
					{loadingComments ? (
						<div className="text-center text-gray-500 py-4">
							Laddar...
						</div>
					) : comments.length === 0 ? (
						<div className="text-center text-gray-500 py-4">
							{t("comments.noArgumentsYet")}
						</div>
					) : (
						<div className="space-y-3">
							{comments.map((comment) => {
								const bgColor =
									comment.type === "for"
										? "bg-green-50"
										: comment.type === "against"
										? "bg-red-50"
										: "bg-white";

								const isCommentRatingExpanded =
									expandedCommentRating === comment._id;
								const userCommentRating =
									commentRatings[comment._id] || 0;
								const avgRating = comment.averageRating || 0;

								return (
									<div
										key={comment._id}
										className={`rounded-xl shadow-sm p-4 ${bgColor}`}
									>
										<div className="flex items-start gap-3">
											{/* Left side: Rating display and button */}
											<div className="flex flex-col items-center gap-2 shrink-0">
												<button
													onClick={() =>
														setExpandedCommentRating(
															isCommentRatingExpanded
																? null
																: comment._id
														)
													}
													className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
														userCommentRating > 0
															? comment.type ===
															  "for"
																? "bg-green-500 hover:bg-green-600"
																: comment.type ===
																  "against"
																? "bg-red-500 hover:bg-red-600"
																: "bg-primary-500 hover:bg-primary-600"
															: "bg-gray-300 hover:bg-gray-400"
													}`}
													title={
														userCommentRating > 0
															? `${t(
																	"rating.yourRating"
															  )}: ${userCommentRating}/5`
															: t(
																	"rating.giveRating"
															  )
													}
												>
													<ThumbsUp className="w-5 h-5 text-white" />
												</button>

												{/* Show user's rating prominently if they've rated */}
												{userCommentRating > 0 && (
													<div className="flex flex-col items-center gap-0.5 bg-white px-2 py-1 rounded-md border border-gray-200">
														<span className="text-xs text-gray-500 font-medium">
															{t(
																"rating.yourRating"
															)}
														</span>
														<div className="flex gap-0.5">
															{[
																1, 2, 3, 4, 5,
															].map((star) => (
																<Star
																	key={star}
																	className={`w-3 h-3 ${
																		star <=
																		userCommentRating
																			? "fill-blue-500 text-primary-500"
																			: "text-gray-300"
																	}`}
																/>
															))}
														</div>
													</div>
												)}

												{/* Show average rating below user rating (or below button if no user rating) */}
												{avgRating > 0 && (
													<div className="flex flex-col items-center gap-0.5">
														<span className="text-xs text-gray-400">
															Ø{" "}
															{avgRating.toFixed(
																1
															)}
														</span>
														<div className="flex gap-0.5">
															{[
																1, 2, 3, 4, 5,
															].map((star) => (
																<Star
																	key={star}
																	className={`w-2.5 h-2.5 ${
																		star <=
																		Math.round(
																			avgRating
																		)
																			? "fill-yellow-400 text-accent-400"
																			: "text-gray-300"
																	}`}
																/>
															))}
														</div>
													</div>
												)}
											</div>

											{/* Right side: Comment content */}
											<div className="flex-1">
												<p className="text-gray-700 text-sm leading-relaxed">
													{comment.text}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{formatDateTime(
														comment.createdAt
													)}
												</p>

												{/* Expandable star rating UI */}
												{isCommentRatingExpanded && (
													<div className="mt-3 flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
														<span className="text-sm text-gray-600">
															{userCommentRating >
															0
																? t(
																		"rating.changeRating"
																  )
																: t(
																		"rating.giveRating"
																  )}
															:
														</span>
														{[1, 2, 3, 4, 5].map(
															(star) => (
																<button
																	key={star}
																	onClick={() =>
																		handleRateComment(
																			comment._id,
																			star
																		)
																	}
																	className="transition-transform hover:scale-125"
																>
																	<Star
																		className={`w-6 h-6 ${
																			star <=
																			userCommentRating
																				? "fill-yellow-400 text-accent-400"
																				: "text-gray-300 hover:text-accent-400"
																		}`}
																	/>
																</button>
															)
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{/* Vote button and collapse indicator */}
					<div className="flex items-center gap-3">
						{userHasVotedInSession &&
						votedProposalId === proposal._id ? (
							<div className="flex-1 bg-green-100 border-2 border-green-500 text-green-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
								<span className="text-xl">✓</span>
								<span>{t("voting.youHaveVoted")}</span>
							</div>
						) : userHasVotedInSession ? (
							<div className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 px-4 rounded-xl text-center cursor-not-allowed">
								{t("voting.alreadyUsedVote")}
							</div>
						) : (
							<button
								onClick={onVote}
								className="flex-1 bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 rounded-xl transition-colors"
							>
								{t("voting.vote")}
							</button>
						)}
						<button
							onClick={handleToggleDiscuss}
							className="text-xs text-gray-500 hover:text-gray-700 bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors"
						>
							▲ {t("comments.hide")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// CREATE PROPOSAL VIEW
// ============================================================================

function CreateProposalView({ onSubmit, onBack, t }) {
	const [title, setTitle] = useState("");
	const [problem, setProblem] = useState("");
	const [solution, setSolution] = useState("");
	const [estimatedCost, setEstimatedCost] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (
			title.trim() &&
			problem.trim() &&
			solution.trim() &&
			estimatedCost.trim()
		) {
			setSubmitting(true);
			await onSubmit(
				title.trim(),
				problem.trim(),
				solution.trim(),
				estimatedCost.trim()
			);
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-accent-50 p-6">
			<div className="max-w-2xl mx-auto">
				<button
					onClick={onBack}
					className="mb-6 text-primary-600 hover:text-primary-700 font-medium"
				>
					← {t("common.back")}
				</button>

				<div className="bg-white rounded-2xl shadow-lg p-8">
					<h2 className="text-2xl font-bold text-primary-800 mb-6">
						{t("createProposal.title")}
					</h2>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("createProposal.nameOfProposal")}
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
								placeholder={t("createProposal.nameExample")}
								autoFocus
								maxLength={200}
								required
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("createProposal.problemLabel")}
							</label>
							<textarea
								value={problem}
								onChange={(e) => setProblem(e.target.value)}
								rows={4}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none resize-none"
								placeholder={t(
									"createProposal.problemPlaceholder"
								)}
								maxLength={1000}
								required
							/>
							<p className="text-xs text-gray-500 mt-1">
								{problem.length}/1000
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("createProposal.solutionLabel")}
							</label>
							<textarea
								value={solution}
								onChange={(e) => setSolution(e.target.value)}
								rows={4}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none resize-none"
								placeholder={t(
									"createProposal.solutionPlaceholder"
								)}
								maxLength={1000}
								required
							/>
							<p className="text-xs text-gray-500 mt-1">
								{solution.length}/1000
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("createProposal.costLabel")}
							</label>
							<input
								type="text"
								value={estimatedCost}
								onChange={(e) =>
									setEstimatedCost(e.target.value)
								}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
								placeholder={t(
									"createProposal.costPlaceholder"
								)}
								maxLength={100}
								required
							/>
						</div>

						<button
							type="submit"
							disabled={
								!title.trim() ||
								!problem.trim() ||
								!solution.trim() ||
								!estimatedCost.trim() ||
								submitting
							}
							className="w-full bg-primary-800 hover:bg-primary-900 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg"
						>
							{submitting
								? t("createProposal.submitting")
								: t("createProposal.submit")}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// VOTE VIEW
// ============================================================================

function VoteView({ proposals, currentUser, onVote, onBack, t }) {
	const [currentProposalIndex, setCurrentProposalIndex] = useState(0);
	const [votedProposals, setVotedProposals] = useState(new Set());
	const [voteResults, setVoteResults] = useState({});
	const [loading, setLoading] = useState(true);
	const [isVoting, setIsVoting] = useState(false);

	useEffect(() => {
		fetchVoteData();
	}, []);

	const fetchVoteData = async () => {
		try {
			const resultsPromises = proposals.map(async (p) => {
				const res = await fetch(
					`/api/votes?proposalId=${p._id}&userId=${currentUser.id}`
				);
				const data = await res.json();
				return { id: p._id, data };
			});

			const results = await Promise.all(resultsPromises);

			const newVotedProposals = new Set();
			const newVoteResults = {};

			results.forEach(({ id, data }) => {
				if (data.hasVoted) {
					newVotedProposals.add(id);
				}
				newVoteResults[id] = data;
			});

			setVotedProposals(newVotedProposals);
			setVoteResults(newVoteResults);
		} catch (error) {
			console.error("Error fetching vote data:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleVote = async (proposalId, choice) => {
		setIsVoting(true);
		await onVote(proposalId, choice);
		await fetchVoteData();
		setIsVoting(false);

		// Move to next proposal after a short delay
		setTimeout(() => {
			if (currentProposalIndex < proposals.length - 1) {
				setCurrentProposalIndex(currentProposalIndex + 1);
			}
		}, 1500);
	};

	const currentProposal = proposals[currentProposalIndex];
	const voted = currentProposal ? votedProposals.has(currentProposal._id) : false;
	const results = currentProposal ? (voteResults[currentProposal._id] || { yes: 0, no: 0, total: 0 }) : { yes: 0, no: 0, total: 0 };

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary-800 flex items-center justify-center">
				<div className="text-white text-xl">{t("common.loading")}</div>
			</div>
		);
	}

	if (!currentProposal) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary-800 flex items-center justify-center">
				<div className="text-center text-white">
					<p className="text-xl">{t("voting.noProposals")}</p>
					<button
						onClick={onBack}
						className="mt-4 px-6 py-3 bg-white text-primary-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
					>
						{t("common.back")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-white">
			{/* Header */}
			<div className="border-b border-primary-700 bg-primary-900/50 backdrop-blur">
				<div className="max-w-4xl mx-auto px-6 py-6">
					<button
						onClick={onBack}
						className="mb-4 text-primary-200 hover:text-white font-medium transition-colors"
					>
						← {t("common.back")}
					</button>
					<div className="text-center">
						<h1 className="text-3xl font-bold mb-2">
							{t("voting.officialVoting")}
						</h1>
						<p className="text-primary-200 text-lg">
							{t("voting.yourVoteMatters")}
						</p>
					</div>
				</div>
			</div>

			{/* Progress indicator */}
			<div className="max-w-4xl mx-auto px-6 py-4">
				<div className="flex items-center justify-center gap-2">
					{proposals.map((_, index) => (
						<div
							key={index}
							className={`h-2 rounded-full transition-all ${
								index === currentProposalIndex
									? "w-12 bg-accent-400"
									: index < currentProposalIndex
									? "w-8 bg-green-400"
									: "w-8 bg-primary-700"
							}`}
						/>
					))}
				</div>
				<p className="text-center text-primary-200 mt-3 text-sm">
					{t("voting.proposalXOfY", {
						current: currentProposalIndex + 1,
						total: proposals.length,
					})}
				</p>
			</div>

			{/* Main voting card */}
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden border-4 border-accent-400">
					{/* Proposal header */}
					<div className="bg-gradient-to-r from-accent-400 to-accent-500 px-8 py-6 text-center">
						<h2 className="text-2xl font-bold text-primary-900">
							{currentProposal.title}
						</h2>
					</div>

					{/* Proposal content */}
					<div className="px-8 py-8 space-y-6">
						<div>
							<h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
								{t("proposals.problemColon")}
							</h3>
							<p className="text-lg leading-relaxed text-gray-800">
								{currentProposal.problem}
							</p>
						</div>

						<div className="border-t border-gray-200 pt-6">
							<h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
								{t("proposals.solutionColon")}
							</h3>
							<p className="text-lg leading-relaxed text-gray-800">
								{currentProposal.solution}
							</p>
						</div>

						<div className="border-t border-gray-200 pt-6">
							<h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
								{t("proposals.estimatedCost")}
							</h3>
							<p className="text-xl font-semibold text-primary-900">
								{currentProposal.estimatedCost}
							</p>
						</div>
					</div>

					{/* Voting section */}
					{!voted ? (
						<div className="px-8 pb-8">
							<div className="border-t-4 border-accent-400 pt-8">
								<p className="text-center text-lg font-semibold text-gray-700 mb-6">
									{t("voting.castYourVote")}
								</p>
								<div className="grid grid-cols-2 gap-6">
									<button
										onClick={() =>
											handleVote(currentProposal._id, "yes")
										}
										disabled={isVoting}
										className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-6 px-8 rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-3"
									>
										<ThumbsUp className="w-12 h-12" />
										<span className="text-2xl">{t("voting.yes")}</span>
									</button>
									<button
										onClick={() =>
											handleVote(currentProposal._id, "no")
										}
										disabled={isVoting}
										className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-6 px-8 rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-3"
									>
										<ThumbsDown className="w-12 h-12" />
										<span className="text-2xl">{t("voting.no")}</span>
									</button>
								</div>
							</div>
						</div>
					) : (
						<div className="px-8 pb-8">
							<div className="border-t-4 border-green-400 pt-8 space-y-4">
								<div className="text-center">
									<div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full font-semibold">
										<span className="text-2xl">✓</span>
										<span>{t("voting.youHaveVoted")}</span>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4 pt-4">
									<div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
										<p className="text-4xl font-bold text-green-700">
											{results.yes}
										</p>
										<p className="text-sm text-green-600 font-medium mt-1">
											{t("voting.yesVotes")}
										</p>
									</div>
									<div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
										<p className="text-4xl font-bold text-red-700">
											{results.no}
										</p>
										<p className="text-sm text-red-600 font-medium mt-1">
											{t("voting.noVotes")}
										</p>
									</div>
								</div>
								<p className="text-center text-sm text-gray-500 pt-2">
									{t("voting.totalVotes", { count: results.total })}
								</p>
								{currentProposalIndex < proposals.length - 1 && (
									<button
										onClick={() =>
											setCurrentProposalIndex(
												currentProposalIndex + 1
											)
										}
										className="w-full mt-4 bg-primary-800 hover:bg-primary-900 text-white font-semibold py-3 rounded-xl transition-colors"
									>
										{t("voting.nextProposal")} →
									</button>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Navigation buttons */}
				{proposals.length > 1 && (
					<div className="flex justify-between mt-6">
						<button
							onClick={() =>
								setCurrentProposalIndex(
									Math.max(0, currentProposalIndex - 1)
								)
							}
							disabled={currentProposalIndex === 0}
							className="px-6 py-3 bg-primary-700 hover:bg-primary-600 disabled:bg-primary-900 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
						>
							← {t("voting.previous")}
						</button>
						<button
							onClick={() =>
								setCurrentProposalIndex(
									Math.min(
										proposals.length - 1,
										currentProposalIndex + 1
									)
								)
							}
							disabled={currentProposalIndex === proposals.length - 1}
							className="px-6 py-3 bg-primary-700 hover:bg-primary-600 disabled:bg-primary-900 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
						>
							{t("voting.next")} →
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
