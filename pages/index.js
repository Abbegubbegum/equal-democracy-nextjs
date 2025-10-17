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
} from "lucide-react";

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);

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

	if (status === "loading" || loading) {
		return <p>Loading</p>;
	}

	return (
		<div className="min-h-screen bg-gray-100 flex items-center justify-center">
			<div className="space-y-4">
				<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
					<MessageCircle className="w-5 h-5" />
					Alla förslag ({proposals.length})
				</h3>

				{proposals.length === 0 ? (
					<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
						<p>
							Inga förslag än. Var den första att föreslå något!
						</p>
					</div>
				) : (
					proposals.map((proposal) => (
						<ProposalCard
							key={proposal._id}
							proposal={proposal}
							onThumbsUp={handleThumbsUp}
							onDiscuss={(id) => router.push(`/proposal/${id}`)}
						/>
					))
				)}
			</div>
		</div>
	);

	function ProposalCard({ proposal, onThumbsUp, onDiscuss }) {
		const [hasVoted, setHasVoted] = useState(false);
		const [checking, setChecking] = useState(true);

		useEffect(() => {
			checkIfVoted();
		}, [proposal._id]);

		const checkIfVoted = async () => {
			try {
				const res = await fetch(
					`/api/thumbsup?proposalId=${proposal._id}`
				);
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
						<p className="text-sm text-gray-400 mt-2">
							Av {proposal.authorName}
						</p>
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
						<span className="font-bold">
							{proposal.thumbsUpCount}
						</span>
					</button>

					<button
						onClick={() => onDiscuss(proposal._id)}
						className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
					>
						<MessageCircle className="w-5 h-5" />
						{proposal.commentsCount || 0}
					</button>
				</div>
			</div>
		);
	}
}
