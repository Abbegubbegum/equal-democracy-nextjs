import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import {
	Users,
	Plus,
	ThumbsUp,
	ThumbsDown,
	MessageCircle,
	TrendingUp,
	Info,
	Clock,
} from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("home"); // 'home', 'create', 'discuss', 'vote'
	const [selectedProposal, setSelectedProposal] = useState(null);
	const [municipalityName, setMunicipalityName] = useState("Vallentuna");
	const [currentPhase, setCurrentPhase] = useState("phase1"); // 'phase1', 'phase2', 'closed'
	const [expandedRating, setExpandedRating] = useState(null); // proposalId currently showing star rating
	const [expandedProposal, setExpandedProposal] = useState(null); // proposalId currently showing arguments
	const [userHasRated, setUserHasRated] = useState(false); // Has user rated at least one proposal
	const [showPhaseTransition, setShowPhaseTransition] = useState(false); // Show transition modal
	const [showSessionClosed, setShowSessionClosed] = useState(false); // Show session closed modal
	const [winningProposals, setWinningProposals] = useState([]); // Winning proposals with yes-majority
	const [transitionCountdown, setTransitionCountdown] = useState(null); // Countdown seconds for phase transition

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	useEffect(() => {
		if (session) {
			fetchProposals();
			fetchMunicipalityName();
			fetchSessionInfo();
		}
	}, [session]);

	const fetchSessionInfo = async () => {
		try {
			const res = await fetch("/api/sessions/current");
			const data = await res.json();
			if (data.phase) {
				const previousPhase = currentPhase;
				setCurrentPhase(data.phase);

				// If session just closed, show modal with winning proposals
				if (data.phase === "closed" && previousPhase !== "closed") {
					await fetchWinningProposals();
					setShowSessionClosed(true);
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

	const fetchMunicipalityName = async () => {
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			if (data.municipalityName) {
				setMunicipalityName(data.municipalityName);
			}
		} catch (error) {
			console.error("Error fetching municipality name:", error);
		}
	};

	const fetchProposals = async () => {
		try {
			const res = await fetch("/api/proposals");
			const data = await res.json();
			setProposals(data);
		} catch (error) {
			console.error("Error fetching proposals:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateProposal = async (title, problem, solution, estimatedCost) => {
		try {
			const res = await fetchWithCsrf("/api/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, problem, solution, estimatedCost }),
			});

			if (res.ok) {
				await fetchProposals();
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
		try {
			const res = await fetchWithCsrf("/api/thumbsup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, rating }),
			});

			if (res.ok) {
				fetchProposals();
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

				// Start polling for execution
				const checkInterval = setInterval(async () => {
					const execRes = await fetchWithCsrf("/api/sessions/execute-scheduled-transition", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
					});

					if (execRes.ok) {
						const execData = await execRes.json();

						if (execData.transitionExecuted) {
							// Transition complete!
							clearInterval(checkInterval);
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
				setTimeout(() => clearInterval(checkInterval), 110000);
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
				await fetchProposals();
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error adding comment:", error);
		}
	};

	const handleMoveToTop3 = async () => {
		const sorted = [...proposals]
			.filter((p) => p.status === "active")
			.sort((a, b) => b.thumbsUpCount - a.thumbsUpCount);

		const top3Ids = sorted.slice(0, 3).map((p) => p._id);

		try {
			const res = await fetchWithCsrf("/api/proposals", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "moveToTop3",
					proposalIds: top3Ids,
				}),
			});

			if (res.ok) {
				fetchProposals();
			}
		} catch (error) {
			console.error("Error updating proposals:", error);
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
				await fetchProposals();

				// Check if session was auto-closed
				if (data.sessionClosed) {
					await fetchWinningProposals();
					await fetchSessionInfo();
					setShowSessionClosed(true);
				}
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error voting:", error);
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
					<h2 className="text-3xl font-bold text-blue-800 mb-4">
						Idéfasen är färdig!
					</h2>
					<p className="text-xl text-gray-700">
						Nu till debatt och omröstning
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
						<h2 className="text-3xl font-bold text-blue-800 mb-4">
							Omröstningen är avslutad
						</h2>
						<p className="text-xl text-gray-700 mb-6">
							Vi har ett resultat:
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
													<p className="font-semibold text-gray-700">Problem:</p>
													<p className="text-gray-600">{proposal.problem}</p>
												</div>
												<div>
													<p className="font-semibold text-gray-700">Lösning:</p>
													<p className="text-gray-600">{proposal.solution}</p>
												</div>
												<div className="flex gap-4 mt-3 text-sm">
													<span className="bg-green-200 text-green-800 px-3 py-1 rounded-full font-semibold">
														JA: {proposal.yesVotes}
													</span>
													<span className="bg-red-200 text-red-800 px-3 py-1 rounded-full font-semibold">
														NEJ: {proposal.noVotes}
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
								Inga förslag fick majoritet i omröstningen.
							</p>
						</div>
					)}

					<div className="text-center">
						<p className="text-xl font-semibold text-blue-800 mb-4">
							Tack för din medverkan!
						</p>
						<button
							onClick={() => {
								setShowSessionClosed(false);
								setView("home");
							}}
							className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
						>
							Stäng
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
			/>
		);
	}

	if (view === "discuss" && selectedProposal) {
		return (
			<DiscussView
				proposal={selectedProposal}
				currentUser={session.user}
				onAddComment={handleAddComment}
				onBack={() => {
					setView("home");
					setSelectedProposal(null);
				}}
			/>
		);
	}

	if (view === "debate") {
		const top3 = proposals.filter((p) => p.status === "top3");
		return (
			<DebateView
				proposals={top3}
				currentUser={session.user}
				onAddComment={handleAddComment}
				onBack={() => setView("home")}
			/>
		);
	}

	if (view === "vote") {
		const top3 = proposals.filter((p) => p.status === "top3");
		return (
			<VoteView
				proposals={top3}
				currentUser={session.user}
				onVote={handleFinalVote}
				onBack={() => setView("home")}
			/>
		);
	}

	// Home view
	// In Phase 1: show active proposals, sorted by creation time (newest first)
	// In Phase 2: show top3 proposals, sorted by rating (highest first)
	const activeProposals = proposals
		.filter((p) => p.status === "active")
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	const top3Proposals = proposals
		.filter((p) => p.status === "top3")
		.sort((a, b) => {
			// Sort by average rating first, then by thumbs up count
			if (b.averageRating !== a.averageRating) {
				return (b.averageRating || 0) - (a.averageRating || 0);
			}
			return b.thumbsUpCount - a.thumbsUpCount;
		});

	// Display proposals based on phase
	const displayProposals = currentPhase === "phase1" ? activeProposals : top3Proposals;

	console.log(session.user.isAdmin);

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
								<Users className="w-6 h-6 text-blue-800" />
							</div>
							<div>
								<h1 className="text-2xl font-bold">
									Jämlik Demokrati
								</h1>
								<p className="text-blue-100 text-sm">
									Hej, {session.user.name}!
								</p>
							</div>
						</div>
						<div className="flex items-center gap-4">
							{session.user.isAdmin && (
								<button
									onClick={() => router.push("/admin")}
									className="text-white hover:text-yellow-400 text-sm font-medium"
								>
									Admin
								</button>
							)}
							<button
								onClick={() => router.push("/dashboard")}
								className="text-white hover:text-yellow-400 text-sm font-medium"
							>
								Min aktivitet
							</button>
							<button
								onClick={() => signOut()}
								className="text-white hover:text-yellow-400 text-sm"
							>
								Logga ut
							</button>
						</div>
					</div>
					<h2 className="text-xl font-medium">
						Hur vill du förbättra {municipalityName}?
					</h2>
				</div>
			</div>

			<div className="max-w-4xl mx-auto p-6 space-y-6">
				{/* Only allow new proposals in Phase 1 */}
				{currentPhase === "phase1" && (
					<button
						onClick={() => setView("create")}
						className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-800 font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
					>
						<Plus className="w-6 h-6" />
						Föreslå en ny idé
					</button>
				)}

				{/* Countdown banner for phase transition */}
				{transitionCountdown !== null && currentPhase === "phase1" && (
					<div className="bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 shadow-md">
						<div className="flex items-center justify-center gap-3">
							<Clock className="w-6 h-6 text-yellow-600 animate-pulse" />
							<p className="text-center text-lg font-semibold text-yellow-800">
								Övergång till Fas 2 om <span className="text-2xl font-bold text-yellow-900">{transitionCountdown}</span> sekunder...
							</p>
						</div>
						<p className="text-center text-sm text-yellow-700 mt-2">
							Tillräckligt många användare och förslag har betygssatts. Systemet övergår snart till Fas 2 där vi diskuterar och röstar om toppförslagen.
						</p>
					</div>
				)}

				{top3Proposals.length > 0 && (
					<div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TrendingUp className="w-6 h-6 text-yellow-600" />
								<h3 className="text-xl font-bold text-blue-800">
									Toppförslag
								</h3>
							</div>
							<div className="flex gap-3">
								<button
									onClick={() => setView("debate")}
									className="bg-yellow-500 hover:bg-yellow-600 text-blue-800 px-4 py-2 rounded-lg font-medium"
								>
									Debattera
								</button>
								<button
									onClick={() => setView("vote")}
									className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
								>
									Rösta
								</button>
							</div>
						</div>
						<p className="text-gray-700">
							Diskutera och rösta på de mest populära idéerna
						</p>
					</div>
				)}


				{/* Old button - can be removed after phase system is working */}
				{activeProposals.length >= 3 && top3Proposals.length === 0 && currentPhase !== "phase1" && (
					<button
						onClick={handleMoveToTop3}
						className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg"
					>
						Lås topp 3 och börja diskutera
					</button>
				)}

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
						<MessageCircle className="w-5 h-5" />
						{currentPhase === "phase1" ? `Alla förslag (${displayProposals.length})` : `Toppförslag (${displayProposals.length})`}
					</h3>

					{displayProposals.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								{currentPhase === "phase1"
									? "Inga förslag än. Var den första att föreslå något!"
									: "Inga toppförslag än."}
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

function ProposalCard({ proposal, currentUser, currentPhase, expandedRating, setExpandedRating, expandedProposal, setExpandedProposal, onThumbsUp, onAddComment, onVote }) {
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

	const checkIfVoted = async () => {
		try {
			const res = await fetch(`/api/thumbsup?proposalId=${proposal._id}`);
			const data = await res.json();
			setHasVoted(data.voted);
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

	return (
		<div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
			{/* Proposal header - clickable in Phase 2 */}
			<div
				className={!isPhase1 ? "cursor-pointer hover:bg-blue-50 -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl transition-all duration-200 hover:shadow-sm" : ""}
				onClick={!isPhase1 ? handleToggleDiscuss : undefined}
			>
				<h4 className={`text-lg font-bold text-blue-800 mb-2 ${!isPhase1 ? "group-hover:text-blue-900" : ""}`}>
					{proposal.title}
				</h4>

				<div className="space-y-3 text-sm">
					<div>
						<p className="font-semibold text-gray-700">Problem:</p>
						<p className="text-gray-600">{proposal.problem}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">Lösning:</p>
						<p className="text-gray-600">{proposal.solution}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">Uppskattad kostnad:</p>
						<p className="text-gray-600">{proposal.estimatedCost}</p>
					</div>
				</div>
			</div>

			{/* Phase 1: Expandable star rating */}
			{isPhase1 && (
				<div>
					<button
						onClick={() => setExpandedRating(isExpanded ? null : proposal._id)}
						disabled={checking}
						className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
							hasVoted
								? "bg-blue-100 text-blue-600"
								: "bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600"
						}`}
					>
						<ThumbsUp className="w-5 h-5" />
						<span>
							{hasVoted ? "Ändra betyg" : "Ge betyg"}
						</span>
					</button>

					{isExpanded && (
						<div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
							{[1, 2, 3, 4, 5].map((star) => {
								const isConfirmed = showConfirmation && star <= confirmedRating;
								return (
									<button
										key={star}
										onClick={() => handleStarClick(star)}
										className="text-3xl hover:scale-110 transition-transform"
										style={{
											color: isConfirmed ? '#dc2626' : 'inherit',
											filter: isConfirmed ? 'brightness(1.2)' : 'none',
										}}
									>
										{isConfirmed ? "⭐" : (star <= userRating ? "⭐" : "☆")}
									</button>
								);
							})}
							<span className="ml-2 text-sm text-gray-600">
								{showConfirmation ? `Betyg ${confirmedRating} registrerat!` : "Klicka på en stjärna"}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Phase 2: Show rating and expand for discussion */}
			{!isPhase1 && (
				<div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-600 font-medium">
					<ThumbsUp className="w-5 h-5" />
					<span className="font-bold">{proposal.thumbsUpCount}</span>
					{proposal.averageRating > 0 && (
						<span className="ml-2">⭐ {proposal.averageRating.toFixed(1)}</span>
					)}
					<span className="ml-auto text-sm">
						{isExpandedForDiscuss ? "▲ Dölj" : "▼ Visa argument"}
					</span>
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
							Neutral
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
							👍 För
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
							👎 Emot
						</button>
					</div>

					{/* Comment input */}
					<form onSubmit={handleSubmitComment} className="flex gap-2">
						<input
							type="text"
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
							placeholder="Skriv ett argument..."
							maxLength={1000}
						/>
						<button
							type="submit"
							disabled={!commentText.trim() || submitting}
							className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm"
						>
							{submitting ? "..." : "Skicka"}
						</button>
					</form>

					{/* Comments list */}
					{loadingComments ? (
						<div className="text-center text-gray-500 py-4">Laddar...</div>
					) : comments.length === 0 ? (
						<div className="text-center text-gray-500 py-4">
							Inga argument än. Var först!
						</div>
					) : (
						<div className="space-y-3">
							{comments.map((comment) => {
								const bgColor = comment.type === "for"
									? "bg-green-50"
									: comment.type === "against"
									? "bg-red-50"
									: "bg-white";

								return (
									<div
										key={comment._id}
										className={`rounded-xl shadow-sm p-4 ${bgColor}`}
									>
										<div className="flex items-start gap-3">
											{comment.type === "for" ? (
												<div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
													<ThumbsUp className="w-5 h-5 text-white" />
												</div>
											) : comment.type === "against" ? (
												<div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shrink-0">
													<ThumbsDown className="w-5 h-5 text-white" />
												</div>
											) : (
												<div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center shrink-0">
													<MessageCircle className="w-5 h-5 text-white" />
												</div>
											)}
											<div className="flex-1">
												<p className="text-gray-700 text-sm leading-relaxed">
													{comment.text}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(comment.createdAt).toLocaleDateString("sv-SE")}
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{/* Vote button */}
					<button
						onClick={onVote}
						className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
					>
						Rösta
					</button>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// CREATE PROPOSAL VIEW
// ============================================================================

function CreateProposalView({ onSubmit, onBack }) {
	const [title, setTitle] = useState("");
	const [problem, setProblem] = useState("");
	const [solution, setSolution] = useState("");
	const [estimatedCost, setEstimatedCost] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (title.trim() && problem.trim() && solution.trim() && estimatedCost.trim()) {
			setSubmitting(true);
			await onSubmit(title.trim(), problem.trim(), solution.trim(), estimatedCost.trim());
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-yellow-50 p-6">
			<div className="max-w-2xl mx-auto">
				<button
					onClick={onBack}
					className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
				>
					← Tillbaka
				</button>

				<div className="bg-white rounded-2xl shadow-lg p-8">
					<h2 className="text-2xl font-bold text-blue-800 mb-6">
						Föreslå en ny idé
					</h2>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Namn på ditt förslag *
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
								placeholder="T.ex. 'Fler cykelbanor i centrum'"
								autoFocus
								maxLength={200}
								required
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Vad är problemet? *
							</label>
							<textarea
								value={problem}
								onChange={(e) => setProblem(e.target.value)}
								rows={4}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
								placeholder="Beskriv vilket problem detta förslag löser..."
								maxLength={1000}
								required
							/>
							<p className="text-xs text-gray-500 mt-1">{problem.length}/1000</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Hur ser lösningen ut? *
							</label>
							<textarea
								value={solution}
								onChange={(e) => setSolution(e.target.value)}
								rows={4}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
								placeholder="Beskriv din lösning i detalj..."
								maxLength={1000}
								required
							/>
							<p className="text-xs text-gray-500 mt-1">{solution.length}/1000</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Uppskattad kostnad *
							</label>
							<input
								type="text"
								value={estimatedCost}
								onChange={(e) => setEstimatedCost(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
								placeholder="T.ex. '100 000 kr', 'Låg kostnad', 'Ingen extra kostnad'"
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
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg"
						>
							{submitting ? "Skickar..." : "Skicka in förslag"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// DISCUSS VIEW
// ============================================================================

function DiscussView({ proposal, currentUser, onAddComment, onBack }) {
	const [commentText, setCommentText] = useState("");
	const [comments, setComments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [commentType, setCommentType] = useState("neutral"); // "for", "against", "neutral"
	const [activeTab, setActiveTab] = useState("all"); // "all", "for", "against"

	useEffect(() => {
		fetchComments();
	}, [proposal._id]);

	const fetchComments = async () => {
		try {
			const res = await fetch(`/api/comments?proposalId=${proposal._id}`);
			const data = await res.json();
			setComments(data);
		} catch (error) {
			console.error("Error fetching comments:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
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

	// Filter comments based on active tab
	const filteredComments = activeTab === "all"
		? comments
		: comments.filter(c => c.type === activeTab);

	return (
		<div className="min-h-screen bg-gray-50 pb-24">
			<div className="bg-blue-600 text-white p-6 shadow-lg">
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="mb-4 text-white hover:text-yellow-400 font-medium"
					>
						← Tillbaka
					</button>
					<h2 className="text-2xl font-bold">{proposal.title}</h2>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-6 space-y-6">
				<div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
					<div>
						<p className="font-semibold text-gray-700">Problem:</p>
						<p className="text-gray-600">{proposal.problem}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">Lösning:</p>
						<p className="text-gray-600">{proposal.solution}</p>
					</div>

					<div>
						<p className="font-semibold text-gray-700">Uppskattad kostnad:</p>
						<p className="text-gray-600">{proposal.estimatedCost}</p>
					</div>

					<div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t">
						<span className="flex items-center gap-1">
							<ThumbsUp className="w-4 h-4" />
							{proposal.thumbsUpCount}
						</span>
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700">
						Diskussion ({comments.length})
					</h3>

					{/* Tabs for filtering comments */}
					<div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm">
						<button
							onClick={() => setActiveTab("all")}
							className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
								activeTab === "all"
									? "bg-blue-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							Alla ({comments.length})
						</button>
						<button
							onClick={() => setActiveTab("for")}
							className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
								activeTab === "for"
									? "bg-green-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							För ({comments.filter(c => c.type === "for").length})
						</button>
						<button
							onClick={() => setActiveTab("against")}
							className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
								activeTab === "against"
									? "bg-red-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							Emot ({comments.filter(c => c.type === "against").length})
						</button>
					</div>

					{loading ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							Laddar kommentarer...
						</div>
					) : filteredComments.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								{activeTab === "all"
									? "Inga kommentarer än. Var den första att diskutera!"
									: `Inga ${activeTab === "for" ? "för" : "emot"}-argument än.`}
							</p>
						</div>
					) : (
						filteredComments.map((comment) => {
							const typeColor = comment.type === "for"
								? "bg-green-50"
								: comment.type === "against"
								? "bg-red-50"
								: "bg-white";

							return (
								<div
									key={comment._id}
									className={`rounded-2xl shadow-md p-6 ${typeColor}`}
								>
									<div className="flex items-start gap-4">
										{/* Icon instead of gray circle */}
										{comment.type === "for" ? (
											<div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shrink-0">
												<ThumbsUp className="w-6 h-6 text-white" />
											</div>
										) : comment.type === "against" ? (
											<div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shrink-0">
												<ThumbsDown className="w-6 h-6 text-white" />
											</div>
										) : (
											<div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center shrink-0">
												<MessageCircle className="w-6 h-6 text-white" />
											</div>
										)}
										<div className="flex-1">
											<p className="text-gray-700 text-base leading-relaxed">
												{comment.text}
											</p>
											<p className="text-xs text-gray-400 mt-2">
												{new Date(
													comment.createdAt
												).toLocaleDateString("sv-SE")}
											</p>
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg">
				<div className="max-w-2xl mx-auto space-y-3">
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
							Neutral
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
							👍 För
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
							👎 Emot
						</button>
					</div>

					<form
						onSubmit={handleSubmit}
						className="flex gap-3"
					>
						<input
							type="text"
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
							placeholder="Skriv en kommentar..."
							maxLength={1000}
						/>
						<button
							type="submit"
							disabled={!commentText.trim() || submitting}
							className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
						>
							{submitting ? "Skickar..." : "Skicka"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// DEBATE VIEW - Streamlined debate with For/Against buttons
// ============================================================================

function DebateView({ proposals, currentUser, onAddComment, onBack }) {
	const [selectedProposal, setSelectedProposal] = useState(null);
	const [selectedType, setSelectedType] = useState(null); // "for" or "against"
	const [commentText, setCommentText] = useState("");
	const [comments, setComments] = useState([]);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (selectedProposal) {
			fetchComments();
		}
	}, [selectedProposal]);

	const fetchComments = async () => {
		if (!selectedProposal) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/comments?proposalId=${selectedProposal._id}`);
			const data = await res.json();
			setComments(data);
		} catch (error) {
			console.error("Error fetching comments:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (commentText.trim() && selectedType) {
			setSubmitting(true);
			await onAddComment(selectedProposal._id, commentText.trim(), selectedType);
			setCommentText("");
			await fetchComments();
			setSubmitting(false);
		}
	};

	const filteredComments = comments.filter(c => c.type === selectedType);

	// Show proposal selection
	if (!selectedProposal) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="bg-blue-600 text-white p-6 shadow-lg">
					<div className="max-w-2xl mx-auto">
						<button
							onClick={onBack}
							className="mb-4 text-white hover:text-yellow-400 font-medium"
						>
							← Tillbaka
						</button>
						<h2 className="text-2xl font-bold">Debattera Toppförslagen</h2>
						<p className="text-blue-100 mt-2">
							Välj ett förslag att debattera
						</p>
					</div>
				</div>

				<div className="max-w-2xl mx-auto p-6 space-y-4">
					{proposals.map((proposal, index) => (
						<div
							key={proposal._id}
							className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
							onClick={() => setSelectedProposal(proposal)}
						>
							<div className="flex items-start gap-3">
								<div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
									<span className="text-blue-800 font-bold text-lg">
										#{index + 1}
									</span>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-bold text-blue-800 mb-2">
										{proposal.title}
									</h4>
									<div className="space-y-2 text-sm">
										<div>
											<p className="font-semibold text-gray-700">Problem:</p>
											<p className="text-gray-600">{proposal.problem}</p>
										</div>
										<div>
											<p className="font-semibold text-gray-700">Lösning:</p>
											<p className="text-gray-600">{proposal.solution}</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	// Show For/Against selection
	if (!selectedType) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="bg-blue-600 text-white p-6 shadow-lg">
					<div className="max-w-2xl mx-auto">
						<button
							onClick={() => setSelectedProposal(null)}
							className="mb-4 text-white hover:text-yellow-400 font-medium"
						>
							← Tillbaka
						</button>
						<h2 className="text-2xl font-bold">{selectedProposal.title}</h2>
						<p className="text-blue-100 mt-2">
							Välj om du vill argumentera för eller emot
						</p>
					</div>
				</div>

				<div className="max-w-2xl mx-auto p-6 space-y-4">
					<div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
						<div>
							<p className="font-semibold text-gray-700">Problem:</p>
							<p className="text-gray-600">{selectedProposal.problem}</p>
						</div>
						<div>
							<p className="font-semibold text-gray-700">Lösning:</p>
							<p className="text-gray-600">{selectedProposal.solution}</p>
						</div>
						<div>
							<p className="font-semibold text-gray-700">Kostnad:</p>
							<p className="text-gray-600">{selectedProposal.estimatedCost}</p>
						</div>
					</div>

					<div className="flex gap-4">
						<button
							onClick={() => setSelectedType("for")}
							className="flex-1 bg-green-400 hover:bg-green-500 text-white font-bold py-8 rounded-xl transition-colors flex flex-col items-center justify-center gap-3"
						>
							<ThumbsUp className="w-12 h-12" />
							<span className="text-xl">För</span>
						</button>
						<button
							onClick={() => setSelectedType("against")}
							className="flex-1 bg-red-400 hover:bg-red-500 text-white font-bold py-8 rounded-xl transition-colors flex flex-col items-center justify-center gap-3"
						>
							<ThumbsDown className="w-12 h-12" />
							<span className="text-xl">Emot</span>
						</button>
					</div>

					{/* Show existing arguments */}
					{loading ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							Laddar argument...
						</div>
					) : (
						<div className="space-y-4">
							{/* For arguments */}
							{comments.filter(c => c.type === "for").length > 0 && (
								<div className="bg-white rounded-2xl shadow-md p-6">
									<h3 className="font-bold text-green-700 mb-3 flex items-center gap-2">
										<ThumbsUp className="w-5 h-5" />
										Förargument ({comments.filter(c => c.type === "for").length})
									</h3>
									<div className="space-y-3">
										{comments.filter(c => c.type === "for").slice(0, 3).map((comment) => (
											<div key={comment._id} className="bg-green-50 rounded-lg p-4">
												<p className="text-gray-700 text-sm leading-relaxed">
													{comment.text}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Against arguments */}
							{comments.filter(c => c.type === "against").length > 0 && (
								<div className="bg-white rounded-2xl shadow-md p-6">
									<h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
										<ThumbsDown className="w-5 h-5" />
										Motargument ({comments.filter(c => c.type === "against").length})
									</h3>
									<div className="space-y-3">
										{comments.filter(c => c.type === "against").slice(0, 3).map((comment) => (
											<div key={comment._id} className="bg-red-50 rounded-lg p-4">
												<p className="text-gray-700 text-sm leading-relaxed">
													{comment.text}
												</p>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Show debate view with pre-selected type
	const headerBgColor = selectedType === "for" ? "bg-green-600" : "bg-red-600";
	const headerText = selectedType === "for" ? "Förargument" : "Motargument";
	const placeholderText = selectedType === "for" ? "Skriv förargument..." : "Skriv motargument...";

	return (
		<div className="min-h-screen bg-gray-50 pb-32">
			<div className={`${headerBgColor} text-white p-6 shadow-lg`}>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={() => setSelectedType(null)}
						className="mb-4 text-white hover:text-yellow-400 font-medium"
					>
						← Tillbaka
					</button>
					<h2 className="text-2xl font-bold">{selectedProposal.title}</h2>
					<p className="text-white opacity-90 mt-2">
						{headerText}
					</p>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-6 space-y-6">
				{/* Proposal details */}
				<div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
					<div>
						<p className="font-semibold text-gray-700">Problem:</p>
						<p className="text-gray-600">{selectedProposal.problem}</p>
					</div>
					<div>
						<p className="font-semibold text-gray-700">Lösning:</p>
						<p className="text-gray-600">{selectedProposal.solution}</p>
					</div>
					<div>
						<p className="font-semibold text-gray-700">Kostnad:</p>
						<p className="text-gray-600">{selectedProposal.estimatedCost}</p>
					</div>
				</div>

				{/* Previous arguments */}
				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700">
						Tidigare {selectedType === "for" ? "förargument" : "motargument"} ({filteredComments.length})
					</h3>

					{loading ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							Laddar...
						</div>
					) : filteredComments.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>Inga {selectedType === "for" ? "förargument" : "motargument"} än. Var först!</p>
						</div>
					) : (
						filteredComments.map((comment) => {
							const bgColor = selectedType === "for" ? "bg-green-50" : "bg-red-50";
							return (
								<div
									key={comment._id}
									className={`rounded-2xl shadow-md p-6 ${bgColor}`}
								>
									<div className="flex items-start gap-4">
										<div className={`w-12 h-12 ${selectedType === "for" ? "bg-green-500" : "bg-red-500"} rounded-full flex items-center justify-center shrink-0`}>
											{selectedType === "for" ? (
												<ThumbsUp className="w-6 h-6 text-white" />
											) : (
												<ThumbsDown className="w-6 h-6 text-white" />
											)}
										</div>
										<div className="flex-1">
											<p className="text-gray-700 text-base leading-relaxed">
												{comment.text}
											</p>
											<p className="text-xs text-gray-400 mt-2">
												{new Date(comment.createdAt).toLocaleDateString("sv-SE")}
											</p>
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* Fixed input at bottom */}
			<div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg">
				<form
					onSubmit={handleSubmit}
					className="max-w-2xl mx-auto space-y-3"
				>
					<div className="text-sm font-semibold text-gray-700">
						{selectedType === "for" ? "Skriv förargument" : "Skriv motargument"}
					</div>
					<div className="flex gap-3">
						<input
							type="text"
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
							placeholder={placeholderText}
							maxLength={1000}
						/>
						<button
							type="submit"
							disabled={!commentText.trim() || submitting}
							className={`${selectedType === "for" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors`}
						>
							{submitting ? "Skickar..." : "Skicka"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ============================================================================
// VOTE VIEW
// ============================================================================

function VoteView({ proposals, currentUser, onVote, onBack }) {
	const [votedProposals, setVotedProposals] = useState(new Set());
	const [voteResults, setVoteResults] = useState({});
	const [loading, setLoading] = useState(true);

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
		await onVote(proposalId, choice);
		await fetchVoteData();
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-green-600 text-white p-6 shadow-lg">
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="mb-4 text-white hover:text-yellow-400 font-medium"
					>
						← Tillbaka
					</button>
					<h2 className="text-2xl font-bold">Rösta på Toppförslagen</h2>
					<p className="text-green-100 mt-2">
						Välj vilka idéer som ska förverkligas
					</p>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-6 space-y-6">
				{loading ? (
					<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
						Laddar...
					</div>
				) : (
					proposals.map((proposal, index) => {
						const voted = votedProposals.has(proposal._id);
						const results = voteResults[proposal._id] || {
							yes: 0,
							no: 0,
							total: 0,
						};

						return (
							<div
								key={proposal._id}
								className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
							>
								<div className="flex items-start gap-3">
									<div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
										<span className="text-blue-800 font-bold text-lg">
											#{index + 1}
										</span>
									</div>
									<div className="flex-1">
										<h4 className="text-lg font-bold text-blue-800 mb-2">
											{proposal.title}
										</h4>

										<div className="space-y-2 text-sm">
											<div>
												<p className="font-semibold text-gray-700">Problem:</p>
												<p className="text-gray-600">{proposal.problem}</p>
											</div>

											<div>
												<p className="font-semibold text-gray-700">Lösning:</p>
												<p className="text-gray-600">{proposal.solution}</p>
											</div>

											<div>
												<p className="font-semibold text-gray-700">Kostnad:</p>
												<p className="text-gray-600">{proposal.estimatedCost}</p>
											</div>
										</div>
									</div>
								</div>

								{!voted ? (
									<div className="flex gap-3">
										<button
											onClick={() =>
												handleVote(proposal._id, "yes")
											}
											className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
										>
											<ThumbsUp className="w-6 h-6" />
											JA
										</button>
										<button
											onClick={() =>
												handleVote(proposal._id, "no")
											}
											className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
										>
											<ThumbsDown className="w-6 h-6" />
											NEJ
										</button>
									</div>
								) : (
									<div className="space-y-2">
										<div className="flex items-center justify-between text-sm text-gray-600 mb-1">
											<span>Resultat</span>
											<span>{results.total} röster</span>
										</div>
										<div className="flex gap-2">
											<div className="flex-1 bg-green-100 rounded-lg p-3 text-center">
												<p className="text-2xl font-bold text-green-700">
													{results.yes}
												</p>
												<p className="text-xs text-green-600">
													Ja
												</p>
											</div>
											<div className="flex-1 bg-red-100 rounded-lg p-3 text-center">
												<p className="text-2xl font-bold text-red-700">
													{results.no}
												</p>
												<p className="text-xs text-red-600">
													Nej
												</p>
											</div>
										</div>
										<p className="text-center text-sm text-green-600 font-medium">
											✓ Du har röstat
										</p>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
