import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import {
	Users,
	Calendar,
	ChevronRight,
	Archive,
	Clock,
	Star,
} from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";
import useSSE from "../lib/hooks/useSSE";

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	const { theme } = useConfig();
	const [loading, setLoading] = useState(true);
	const [activeSessions, setActiveSessions] = useState([]);
	const [archivedSessions, setArchivedSessions] = useState([]);
	const [showArchive, setShowArchive] = useState(false);
	const [view, setView] = useState("home"); // 'home', 'apply-admin'

	// Fetch all active sessions
	const fetchActiveSessions = useCallback(async () => {
		try {
			const res = await fetch("/api/sessions/active");
			const data = await res.json();
			const sessions = Array.isArray(data) ? data : [];
			setActiveSessions(sessions);
		} catch (error) {
			console.error("Error fetching active sessions:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Fetch archived sessions
	const fetchArchivedSessions = useCallback(async () => {
		try {
			const res = await fetch("/api/sessions/archived");
			const data = await res.json();
			const sessions = Array.isArray(data) ? data : [];
			setArchivedSessions(sessions);
		} catch (error) {
			console.error("Error fetching archived sessions:", error);
		}
	}, []);

	// Setup SSE for real-time updates - listen for new sessions
	useSSE({
		onNewSession: async () => {
			// Refresh sessions list when a new session is created
			await fetchActiveSessions();
		},
		onPhaseChange: async () => {
			// Refresh sessions list when a session phase changes
			await fetchActiveSessions();
		},
		onSessionArchived: async () => {
			// Refresh both lists when a session is archived
			await fetchActiveSessions();
			await fetchArchivedSessions();
		},
		onConnected: () => {},
		onError: (error) => {
			console.error("Connection error:", error);
		},
	});

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	// Check for expired ranking sessions to archive on load
	useEffect(() => {
		const checkForArchiving = async () => {
			try {
				await fetch("/api/sessions/check-archive", { method: "POST" });
				// Refresh lists after checking
				await fetchActiveSessions();
				await fetchArchivedSessions();
			} catch (error) {
				console.error("Error checking for sessions to archive:", error);
			}
		};

		if (session) {
			checkForArchiving();
		}
	}, [session, fetchActiveSessions, fetchArchivedSessions]);

	useEffect(() => {
		if (session) {
			fetchActiveSessions();
			fetchArchivedSessions();
		}
	}, [session, fetchActiveSessions, fetchArchivedSessions]);

	// Refresh sessions periodically
	useEffect(() => {
		if (!session) return;

		const pollInterval = setInterval(() => {
			fetchActiveSessions();
		}, 30000); // Every 30 seconds

		return () => clearInterval(pollInterval);
	}, [session, fetchActiveSessions]);

	const handleApplyForAdmin = async (
		name,
		organization,
		requestedSessions
	) => {
		try {
			const { fetchWithCsrf } = await import("../lib/fetch-with-csrf");
			const res = await fetchWithCsrf("/api/apply-admin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					organization,
					requestedSessions: parseInt(requestedSessions),
				}),
			});

			const data = await res.json();

			if (res.ok) {
				alert(t("admin.applicationSubmitted"));
				setView("home");
			} else {
				alert(data.message || t("errors.generic"));
			}
		} catch (error) {
			console.error("Error applying for admin:", error);
			alert(t("errors.generic"));
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

	// Get theme colors
	const primaryColor = theme.colors.primary[600] || "#2563eb";
	const accentColor = theme.colors.accent[400] || "#facc15";
	const primaryDark = theme.colors.primary[800] || "#1e40af";

	if (view === "apply-admin") {
		return (
			<ApplyAdminView
				onSubmit={handleApplyForAdmin}
				onBack={() => setView("home")}
				userEmail={session.user.email}
				userName={session.user.name}
				t={t}
				theme={theme}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 overflow-x-hidden">
			{/* Header */}
			<div
				className="text-white p-4 sm:p-6 shadow-lg"
				style={{
					background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
				}}
			>
				<div className="max-w-4xl mx-auto">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
						<div className="flex items-center gap-3">
							<div
								className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
								style={{ backgroundColor: accentColor }}
							>
								<Users
									className="w-6 h-6"
									style={{ color: primaryDark }}
								/>
							</div>
							<div className="min-w-0">
								<h1 className="text-xl sm:text-2xl font-bold wrap-break-word">
									{t("appName")}
								</h1>
								<p className="text-primary-100 text-xs sm:text-sm wrap-break-word">
									{t("auth.hello")}, {session.user.name}!
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
							{session.user.isSuperAdmin && (
								<>
									<button
										onClick={() => router.push("/admin")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.admin")}
									</button>
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								</>
							)}
							{session.user.isAdmin &&
								!session.user.isSuperAdmin && (
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								)}
							{!session.user.isAdmin &&
								!session.user.isSuperAdmin && (
									<button
										onClick={() => setView("apply-admin")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.applyForAdmin")}
									</button>
								)}
							<button
								onClick={() => signOut()}
								className="text-white hover:text-accent-400 whitespace-nowrap"
							>
								{t("auth.logout")}
							</button>
						</div>
					</div>
					<h2 className="text-lg sm:text-xl font-medium">
						{t("sessions.selectSession") ||
							"Select a session to participate"}
					</h2>
				</div>
			</div>

			{/* Session cards */}
			<div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
				{activeSessions.length === 0 ? (
					<div className="bg-white rounded-2xl shadow-md p-8 text-center">
						<div className="text-6xl mb-4">📭</div>
						<h3 className="text-xl font-bold text-gray-800 mb-2">
							{t("sessions.noActiveSessions") ||
								"No active sessions"}
						</h3>
						<p className="text-gray-600">
							{t("sessions.checkBackLater") ||
								"Check back later or contact an administrator to create a session."}
						</p>
					</div>
				) : (
					<div className="grid gap-4 sm:gap-6">
						{activeSessions.map((sessionItem) => (
							<SessionCard
								key={sessionItem._id}
								session={sessionItem}
								onClick={() =>
									router.push(`/session/${sessionItem._id}`)
								}
								t={t}
								primaryDark={primaryDark}
								accentColor={accentColor}
							/>
						))}
					</div>
				)}

				{/* Archived Sessions Section */}
				{archivedSessions.length > 0 && (
					<div className="mt-8">
						<button
							onClick={() => setShowArchive(!showArchive)}
							className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
						>
							<div className="flex items-center gap-3">
								<Archive className="w-5 h-5 text-gray-600" />
								<span className="font-semibold text-gray-700">
									{t("archive.archivedRankings") ||
										"Archived Rankings"}{" "}
									({archivedSessions.length})
								</span>
							</div>
							<ChevronRight
								className={`w-5 h-5 text-gray-500 transition-transform ${
									showArchive ? "rotate-90" : ""
								}`}
							/>
						</button>

						{showArchive && (
							<div className="mt-4 space-y-4">
								{archivedSessions.map((archivedSession) => (
									<ArchivedSessionCard
										key={archivedSession._id}
										session={archivedSession}
										onClick={() =>
											router.push(
												`/archive/${archivedSession._id}`
											)
										}
										t={t}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// SESSION CARD COMPONENT
// ============================================================================

function SessionCard({
	session,
	onClick,
	t,
	primaryDark,
	accentColor,
}) {
	const isSurvey = session.sessionType === "survey";

	const phaseLabel = isSurvey
		? t("ranking.liveRankings") || "Live Rankings"
		: session.phase === "phase1"
			? t("phases.phase1") || "Phase 1 - Idea Collection"
			: session.phase === "phase2"
				? t("phases.phase2") || "Phase 2 - Voting"
				: t("phases.closed") || "Closed";

	const phaseColor = isSurvey
		? "bg-purple-100 text-purple-800"
		: session.phase === "phase1"
			? "bg-blue-100 text-blue-800"
			: session.phase === "phase2"
				? "bg-green-100 text-green-800"
				: "bg-gray-100 text-gray-800";

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("sv-SE", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<button
			onClick={onClick}
			className="w-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 p-6 text-left group hover:scale-[1.02]"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{/* Session name/place */}
					<h3 className="text-xl font-bold text-gray-900 mb-2 wrap-break-word group-hover:text-primary-700">
						{session.place || "Unnamed Session"}
					</h3>

					{/* Phase badge */}
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span
							className={`px-3 py-1 rounded-full text-sm font-medium ${phaseColor}`}
						>
							{phaseLabel}
						</span>
						{session.activeUsersCount > 0 && (
							<span className="flex items-center gap-1 text-sm text-gray-500">
								<Users className="w-4 h-4" />
								{session.activeUsersCount}{" "}
								{t("sessions.activeUsers") || "active"}
							</span>
						)}
					</div>

					{/* Session info */}
					<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
						{session.startDate && (
							<span className="flex items-center gap-1">
								<Calendar className="w-4 h-4" />
								{formatDate(session.startDate)}
							</span>
						)}
						{isSurvey && session.archiveDate && (
							<span className="flex items-center gap-1 text-purple-600">
								<Clock className="w-4 h-4" />
								{(() => {
									const now = new Date();
									const archive = new Date(
										session.archiveDate
									);
									const diff = archive - now;
									if (diff <= 0)
										return (
											t("ranking.rankingEnded") || "Ended"
										);
									const days = Math.floor(
										diff / (1000 * 60 * 60 * 24)
									);
									const hours = Math.floor(
										(diff % (1000 * 60 * 60 * 24)) /
											(1000 * 60 * 60)
									);
									return days > 0
										? `${days}d ${hours}h`
										: `${hours}h`;
								})()}{" "}
								{t("ranking.timeRemaining") || "remaining"}
							</span>
						)}
					</div>
				</div>

				{/* Arrow indicator */}
				<div
					className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
					style={{ backgroundColor: accentColor }}
				>
					<ChevronRight
						className="w-6 h-6"
						style={{ color: primaryDark }}
					/>
				</div>
			</div>
		</button>
	);
}

// ============================================================================
// ARCHIVED SESSION CARD COMPONENT
// ============================================================================

function ArchivedSessionCard({ session, onClick, t }) {
	const formatDate = (dateString) => {
		if (!dateString) return "";
		const date = new Date(dateString);
		return date.toLocaleDateString("sv-SE", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	return (
		<button
			onClick={onClick}
			className="w-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 p-5 text-left group hover:scale-[1.01] border border-gray-200"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{/* Session name */}
					<h3 className="text-lg font-bold text-gray-800 mb-2 wrap-break-word group-hover:text-purple-700">
						{session.place || "Unnamed Ranking"}
					</h3>

					{/* Ranking info badges */}
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
							{t("archive.archived") || "Archived"}
						</span>
						{session.participantCount > 0 && (
							<span className="flex items-center gap-1 text-xs text-gray-500">
								<Users className="w-3 h-3" />
								{session.participantCount}{" "}
								{t("archive.participants") || "participants"}
							</span>
						)}
					</div>

					{/* Top responses preview */}
					{session.topProposals &&
						session.topProposals.length > 0 && (
							<div className="space-y-1 mb-2">
								{session.topProposals
									.slice(0, 3)
									.map((proposal, index) => (
										<div
											key={proposal._id}
											className="flex items-center gap-2 text-sm"
										>
											<span
												className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
													index === 0
														? "bg-yellow-500"
														: index === 1
															? "bg-gray-400"
															: "bg-orange-500"
												}`}
											>
												{index + 1}
											</span>
											<span className="text-gray-700 truncate flex-1">
												{proposal.title}
											</span>
											<span className="text-xs text-gray-500 flex items-center gap-0.5">
												<Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
												{(
													proposal.averageRating || 0
												).toFixed(1)}
											</span>
										</div>
									))}
							</div>
						)}

					{/* Dates */}
					<div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
						{session.startDate && (
							<span className="flex items-center gap-1">
								<Calendar className="w-3 h-3" />
								{formatDate(session.startDate)} -{" "}
								{formatDate(session.endDate)}
							</span>
						)}
					</div>
				</div>

				{/* Arrow indicator */}
				<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-purple-100 transition-colors">
					<ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-600" />
				</div>
			</div>
		</button>
	);
}

// ============================================================================
// APPLY ADMIN VIEW
// ============================================================================

function ApplyAdminView({ onSubmit, onBack, userEmail, userName, t, theme }) {
	const [name, setName] = useState(userName || "");
	const [organization, setOrganization] = useState("");
	const [requestedSessions, setRequestedSessions] = useState("10");
	const [submitting, setSubmitting] = useState(false);

	const primaryColor = theme.colors.primary[600];
	const primaryDark = theme.colors.primary[900];
	const accentColor = theme.colors.accent[400];

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!name || !organization || !requestedSessions) {
			alert(t("errors.generic"));
			return;
		}

		const sessions = parseInt(requestedSessions);
		if (isNaN(sessions) || sessions < 1 || sessions > 50) {
			alert("Please enter a number between 1 and 50 for sessions");
			return;
		}

		setSubmitting(true);
		await onSubmit(name, organization, sessions);
		setSubmitting(false);
	};

	return (
		<div className="min-h-screen" style={{ backgroundColor: primaryColor }}>
			<div
				className="p-4 sm:p-6"
				style={{ backgroundColor: primaryDark }}
			>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="text-white hover:text-accent-400 mb-4 flex items-center gap-2"
					>
						← {t("common.back")}
					</button>
					<h1 className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
						{t("admin.applyForAdmin")}
					</h1>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-4 sm:p-6">
				<form
					onSubmit={handleSubmit}
					className="bg-white rounded-2xl shadow-lg p-6 space-y-6"
				>
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("auth.email")}
						</label>
						<input
							type="email"
							value={userEmail}
							disabled
							className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-slate-100 text-slate-600"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("auth.name")} *
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t("auth.name")}
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("admin.organization")} *
						</label>
						<input
							type="text"
							value={organization}
							onChange={(e) => setOrganization(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t("admin.organizationPlaceholder")}
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("admin.requestedSessions")} * (1-50)
						</label>
						<input
							type="number"
							min="1"
							max="50"
							value={requestedSessions}
							onChange={(e) =>
								setRequestedSessions(e.target.value)
							}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="10"
							required
						/>
						<p className="text-sm text-slate-500 mt-1">
							{t("admin.requestedSessionsHelp")}
						</p>
					</div>

					<button
						type="submit"
						disabled={submitting}
						className="w-full font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
						style={{
							backgroundColor: accentColor,
							color: primaryDark,
						}}
					>
						{submitting
							? t("common.submit") + "..."
							: t("common.submit")}
					</button>
				</form>
			</div>
		</div>
	);
}
