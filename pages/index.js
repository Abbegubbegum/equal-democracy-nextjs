import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import {
	Users,
	Plus,
	ThumbsUp,
	MessageCircle,
	TrendingUp,
	Info,
	CheckCircle,
} from "lucide-react";

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("home"); // 'home', 'create', 'discuss', 'vote'
	const [selectedProposal, setSelectedProposal] = useState(null);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	useEffect(() => {
		if (session) {
			fetchProposals();
		}
	}, [session]);

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

	const handleCreateProposal = async (title, description) => {
		try {
			const res = await fetch("/api/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, description }),
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

	const handleThumbsUp = async (proposalId) => {
		try {
			const res = await fetch("/api/thumbsup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId }),
			});

			if (res.ok) {
				fetchProposals();
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error voting:", error);
		}
	};

	const handleAddComment = async (proposalId, text) => {
		try {
			const res = await fetch("/api/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, text }),
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
			const res = await fetch("/api/proposals", {
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
			const res = await fetch("/api/votes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, choice }),
			});

			if (res.ok) {
				await fetchProposals();
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
	const activeProposals = proposals
		.filter((p) => p.status === "active")
		.sort((a, b) => b.thumbsUpCount - a.thumbsUpCount);

	const top3Proposals = proposals.filter((p) => p.status === "top3");

	console.log(session.user.isAdmin);

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
								<Users className="w-6 h-6 text-blue-800" />
							</div>
							<div>
								<h1 className="text-2xl font-bold">
									Equal Democracy
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
						Hur vill du förbättra vår stad?
					</h2>
				</div>
			</div>

			<div className="max-w-4xl mx-auto p-6 space-y-6">
				<button
					onClick={() => setView("create")}
					className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-800 font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
				>
					<Plus className="w-6 h-6" />
					Föreslå en ny idé
				</button>

				{top3Proposals.length > 0 && (
					<div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TrendingUp className="w-6 h-6 text-yellow-600" />
								<h3 className="text-xl font-bold text-blue-800">
									Topp 3 förslag
								</h3>
							</div>
							<button
								onClick={() => setView("vote")}
								className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
							>
								Rösta nu
							</button>
						</div>
						<p className="text-gray-700">
							Diskutera och rösta på de mest populära idéerna
						</p>
					</div>
				)}

				{activeProposals.length >= 3 && top3Proposals.length === 0 && (
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
						Alla förslag ({activeProposals.length})
					</h3>

					{activeProposals.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								Inga förslag än. Var den första att föreslå
								något!
							</p>
						</div>
					) : (
						activeProposals.map((proposal) => (
							<ProposalCard
								key={proposal._id}
								proposal={proposal}
								currentUser={session.user}
								onThumbsUp={handleThumbsUp}
								onDiscuss={(p) => {
									setSelectedProposal(p);
									setView("discuss");
								}}
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

function ProposalCard({ proposal, currentUser, onThumbsUp, onDiscuss }) {
	const [hasVoted, setHasVoted] = useState(false);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		checkIfVoted();
	}, [proposal._id]);

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

	return (
		<div className="bg-white rounded-2xl shadow-md p-6 space-y-4 hover:shadow-lg transition-shadow">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<h4 className="text-lg font-bold text-blue-800 mb-2">
						{proposal.title}
					</h4>
					<p className="text-gray-600">{proposal.description}</p>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<button
					onClick={() => onThumbsUp(proposal._id)}
					disabled={hasVoted || checking}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
						hasVoted
							? "bg-blue-100 text-blue-600 cursor-not-allowed"
							: "bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600"
					}`}
				>
					<ThumbsUp className="w-5 h-5" />
					<span className="font-bold">{proposal.thumbsUpCount}</span>
				</button>

				<button
					onClick={() => onDiscuss(proposal)}
					className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
				>
					<MessageCircle className="w-5 h-5" />
					{proposal.commentsCount || 0}
				</button>
			</div>
		</div>
	);
}

// ============================================================================
// CREATE PROPOSAL VIEW
// ============================================================================

function CreateProposalView({ onSubmit, onBack }) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (title.trim() && description.trim()) {
			setSubmitting(true);
			await onSubmit(title.trim(), description.trim());
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 p-6">
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
								Rubrik
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
								placeholder="T.ex. 'Fler cykelbanor i centrum'"
								autoFocus
								maxLength={200}
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Beskrivning
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={6}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
								placeholder="Beskriv din idé och varför den är viktig..."
								maxLength={2000}
							/>
						</div>

						<button
							type="submit"
							disabled={
								!title.trim() ||
								!description.trim() ||
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
			await onAddComment(proposal._id, commentText.trim());
			setCommentText("");
			await fetchComments();
			setSubmitting(false);
		}
	};

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
				<div className="bg-white rounded-2xl shadow-md p-6">
					<p className="text-gray-700 mb-4">{proposal.description}</p>
					<div className="flex items-center gap-4 text-sm text-gray-500">
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

					{loading ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							Laddar kommentarer...
						</div>
					) : comments.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								Inga kommentarer än. Var den första att
								diskutera!
							</p>
						</div>
					) : (
						comments.map((comment) => (
							<div
								key={comment._id}
								className="bg-white rounded-2xl shadow-md p-6"
							>
								<div className="flex items-start gap-3">
									<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"></div>
									<div className="flex-1">
										<p className="text-gray-600 mt-1">
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
						))
					)}
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg">
				<form
					onSubmit={handleSubmit}
					className="max-w-2xl mx-auto flex gap-3"
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
					<h2 className="text-2xl font-bold">Rösta på topp 3</h2>
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
									<div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
										<span className="text-blue-800 font-bold text-lg">
											#{index + 1}
										</span>
									</div>
									<div className="flex-1">
										<h4 className="text-lg font-bold text-blue-800 mb-2">
											{proposal.title}
										</h4>
										<p className="text-gray-600">
											{proposal.description}
										</p>
									</div>
								</div>

								{!voted ? (
									<div className="flex gap-3">
										<button
											onClick={() =>
												handleVote(proposal._id, "yes")
											}
											className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
										>
											<CheckCircle className="w-5 h-5" />
											Ja
										</button>
										<button
											onClick={() =>
												handleVote(proposal._id, "no")
											}
											className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors"
										>
											Nej
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
