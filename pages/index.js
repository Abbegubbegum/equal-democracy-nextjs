import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { Users, Calendar, ChevronRight } from "lucide-react";
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

	// Setup SSE for real-time updates - listen for new sessions
	useSSE({
		onNewSession: async (sessionData) => {
			// Refresh sessions list when a new session is created
			await fetchActiveSessions();
		},
		onPhaseChange: async (phaseData) => {
			// Refresh sessions list when a session phase changes
			await fetchActiveSessions();
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

	useEffect(() => {
		if (session) {
			fetchActiveSessions();
		}
	}, [session, fetchActiveSessions]);

	// Refresh sessions periodically
	useEffect(() => {
		if (!session) return;

		const pollInterval = setInterval(() => {
			fetchActiveSessions();
		}, 30000); // Every 30 seconds

		return () => clearInterval(pollInterval);
	}, [session, fetchActiveSessions]);

	const handleApplyForAdmin = async (name, organization, requestedSessions) => {
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
								<Users className="w-6 h-6" style={{ color: primaryDark }} />
							</div>
							<div className="min-w-0">
								<h1 className="text-xl sm:text-2xl font-bold break-words">
									{t("appName")}
								</h1>
								<p className="text-primary-100 text-xs sm:text-sm break-words">
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
										onClick={() => router.push("/manage-sessions")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										Manage Sessions
									</button>
								</>
							)}
							{session.user.isAdmin && !session.user.isSuperAdmin && (
								<button
									onClick={() => router.push("/manage-sessions")}
									className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
								>
									Manage Sessions
								</button>
							)}
							{!session.user.isAdmin && !session.user.isSuperAdmin && (
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
						{t("sessions.selectSession") || "Select a session to participate"}
					</h2>
				</div>
			</div>

			{/* Session cards */}
			<div className="max-w-4xl mx-auto p-4 sm:p-6">
				{activeSessions.length === 0 ? (
					<div className="bg-white rounded-2xl shadow-md p-8 text-center">
						<div className="text-6xl mb-4">📭</div>
						<h3 className="text-xl font-bold text-gray-800 mb-2">
							{t("sessions.noActiveSessions") || "No active sessions"}
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
								onClick={() => router.push(`/session/${sessionItem._id}`)}
								t={t}
								primaryColor={primaryColor}
								primaryDark={primaryDark}
								accentColor={accentColor}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// SESSION CARD COMPONENT
// ============================================================================

function SessionCard({ session, onClick, t, primaryColor, primaryDark, accentColor }) {
	const phaseLabel =
		session.phase === "phase1"
			? t("phases.phase1") || "Phase 1 - Idea Collection"
			: session.phase === "phase2"
			? t("phases.phase2") || "Phase 2 - Voting"
			: t("phases.closed") || "Closed";

	const phaseColor =
		session.phase === "phase1"
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
					<h3 className="text-xl font-bold text-gray-900 mb-2 break-words group-hover:text-primary-700">
						{session.place || "Unnamed Session"}
					</h3>

					{/* Phase badge */}
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span className={`px-3 py-1 rounded-full text-sm font-medium ${phaseColor}`}>
							{phaseLabel}
						</span>
						{session.activeUsersCount > 0 && (
							<span className="flex items-center gap-1 text-sm text-gray-500">
								<Users className="w-4 h-4" />
								{session.activeUsersCount} {t("sessions.activeUsers") || "active"}
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
					</div>
				</div>

				{/* Arrow indicator */}
				<div
					className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
					style={{ backgroundColor: accentColor }}
				>
					<ChevronRight className="w-6 h-6" style={{ color: primaryDark }} />
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
			<div className="p-4 sm:p-6" style={{ backgroundColor: primaryDark }}>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="text-white hover:text-accent-400 mb-4 flex items-center gap-2"
					>
						← {t("common.back")}
					</button>
					<h1 className="text-2xl sm:text-3xl font-bold text-white break-words">
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
							onChange={(e) => setRequestedSessions(e.target.value)}
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
						{submitting ? t("common.submit") + "..." : t("common.submit")}
					</button>
				</form>
			</div>
		</div>
	);
}
