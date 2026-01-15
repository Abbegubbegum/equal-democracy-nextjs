import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Calendar, ArrowLeft } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";

export default function ManageSessionsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { theme } = useConfig();

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
			router.replace("/");
	}, [status, session, router]);

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

	const primaryColor = theme?.primaryColor || "#1e40af";
	const primaryDark = theme?.primaryDark || "#1e3a8a";
	const accentColor = theme?.accentColor || "#fbbf24";

	return (
		<div className="min-h-screen bg-gray-50">
			<header
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
								<Calendar
									className="w-6 h-6"
									style={{ color: primaryDark }}
								/>
							</div>
							<div className="min-w-0">
								<h1 className="text-xl sm:text-2xl font-bold break-words">
									Manage Sessions
								</h1>
								<p className="text-primary-100 text-xs sm:text-sm break-words">
									Create and manage democracy sessions
								</p>
							</div>
						</div>
						<button
							onClick={() => router.push("/")}
							className="text-white hover:opacity-80 font-medium whitespace-nowrap flex items-center gap-2 text-sm"
						>
							<ArrowLeft className="w-4 h-4" />
							Back to home
						</button>
					</div>
				</div>
			</header>

			<main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
				<SessionsPanel isSuperAdmin={session.user?.isSuperAdmin} />
			</main>
		</div>
	);
}

function SessionsPanel({ isSuperAdmin }) {
	const { data: session } = useSession();
	const { theme } = useConfig();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newPlace, setNewPlace] = useState("");
	const [maxOneProposalPerUser, setMaxOneProposalPerUser] = useState(false);
	const [showUserCount, setShowUserCount] = useState(false);
	const [noMotivation, setNoMotivation] = useState(false);
	const [singleResult, setSingleResult] = useState(false);
	const [message, setMessage] = useState("");
	const [remainingSessions, setRemainingSessions] = useState(null);
	const [requestedSessions, setRequestedSessions] = useState("10");
	const [language, setLanguage] = useState("sv");
	const [themeValue, setThemeValue] = useState("default");
	const [settingsLoaded, setSettingsLoaded] = useState(false);

	const accentColor = theme?.accentColor || "#fbbf24";
	const primaryDark = theme?.primaryDark || "#1e3a8a";

	const loadSessions = useCallback(async () => {
		setLoading(true);
		try {
			// First, check if there's any active session (regardless of creator)
			const activeSessionRes = await fetch("/api/sessions/current");
			let globalActiveSession = null;
			if (activeSessionRes.ok) {
				const activeSessionData = await activeSessionRes.json();
				if (activeSessionData && activeSessionData._id) {
					globalActiveSession = activeSessionData;
				}
			}

			// Then load sessions filtered by creator (for regular admins)
			const res = await fetch("/api/admin/sessions");
			if (res.ok) {
				const data = await res.json();
				const sessionsData = Array.isArray(data) ? data : [];

				// If there's a global active session not in our list, add it with limited info
				if (
					globalActiveSession &&
					!sessionsData.some((s) => s._id === globalActiveSession._id)
				) {
					sessionsData.unshift({
						_id: globalActiveSession._id,
						place: globalActiveSession.place,
						status: globalActiveSession.status,
						phase: globalActiveSession.phase,
						startDate: globalActiveSession.startDate,
						createdBy: "other", // Mark as created by someone else
						isOtherUserSession: true,
					});
				}

				setSessions(sessionsData);
			} else {
				console.error("Error loading sessions:", res.status);
				setSessions([]);
			}
		} catch (error) {
			console.error("Error loading sessions:", error);
			setSessions([]);
		}
		setLoading(false);
	}, []);

	const loadSessionLimit = useCallback(async () => {
		try {
			const res = await fetch("/api/admin/session-limit");
			if (res.ok) {
				const data = await res.json();
				setRemainingSessions(data.remaining);
			}
		} catch (error) {
			console.error("Error loading session limit:", error);
		}
	}, []);

	const loadSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/settings");
			if (res.ok) {
				const data = await res.json();
				setLanguage(data.language || "sv");
				setThemeValue(data.theme || "default");
				setSettingsLoaded(true);
			} else {
				console.error("Error loading settings:", res.status);
			}
		} catch (error) {
			console.error("Error loading settings:", error);
		}
	}, []);

	useEffect(() => {
		loadSessions(); // eslint-disable-line react-hooks/set-state-in-effect
		loadSessionLimit();
		loadSettings();
		setNewPlace("Write a short question max eight words here");
	}, [loadSessions, loadSessionLimit, loadSettings]);

	const saveSettings = async () => {
		try {
			const res = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					language,
					theme: themeValue,
				}),
			});

			if (res.ok) {
				// Settings saved successfully, will reload page after session creation
				return true;
			} else {
				const error = await res.json();
				console.error("Error saving settings:", error);
				return false;
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			return false;
		}
	};

	const createSession = async () => {
		if (!newPlace) {
			setMessage("Place required");
			return;
		}

		// Warn user if this is their last session
		if (!session?.user?.isSuperAdmin && remainingSessions === 1) {
			const confirmed = confirm(
				"Warning: This is your last available session. After creating this session, you will need to request more sessions from a superadmin to create additional sessions. Do you want to continue?"
			);
			if (!confirmed) {
				return;
			}
		}

		setCreating(true);
		setMessage("");

		try {
			// Save settings first
			const settingsSaved = await saveSettings();

			const res = await fetchWithCsrf("/api/admin/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					place: newPlace,
					maxOneProposalPerUser: maxOneProposalPerUser,
					showUserCount: showUserCount,
					noMotivation: noMotivation,
					singleResult: singleResult,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.isLastSession) {
					setMessage(
						"Session created! This was your last available session. You can request more sessions below."
					);
				} else {
					setMessage("Session created!");
				}

				// Reload page to apply new settings if they were saved
				if (settingsSaved) {
					setTimeout(() => {
						window.location.reload();
					}, 1500);
				} else {
					loadSessions();
					loadSessionLimit();
					setNewPlace("Write a short question max eight words here");
					setMaxOneProposalPerUser(false);
					setTimeout(
						() => setMessage(""),
						data.isLastSession ? 5000 : 3000
					);
				}
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error creating session:", error);
			setMessage("Could not create session");
		}

		setCreating(false);
	};

	const requestMoreSessions = async () => {
		const sessions = parseInt(requestedSessions);
		if (isNaN(sessions) || sessions < 1 || sessions > 50) {
			alert("Please enter a number between 1 and 50");
			return;
		}

		try {
			const res = await fetchWithCsrf(
				"/api/admin/request-more-sessions",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ requestedSessions: sessions }),
				}
			);

			if (res.ok) {
				alert(
					"Your request for more sessions has been submitted. A superadmin will review it shortly."
				);
				setRequestedSessions("10");
			} else {
				const error = await res.json();
				alert(`Error: ${error.message}`);
			}
		} catch (error) {
			console.error("Error requesting more sessions:", error);
			alert("Could not submit request");
		}
	};

	const closeSession = async (sessionId) => {
		if (
			!confirm(
				"Are you sure you want to close this session? All proposals will be archived and winning proposals moved to top proposals."
			)
		) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/admin/close-session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});

			if (res.ok) {
				const data = await res.json();
				alert(
					`Session closed! ${data.topProposals.length} top proposals saved.`
				);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error closing session:", error);
			alert("Could not close session");
		}
	};

	if (loading)
		return (
			<div className="p-6 bg-white rounded-2xl shadow-lg">Loading…</div>
		);

	const activeSession = sessions.find((s) => s.status === "active");
	const closedSessions = sessions.filter((s) => s.status === "closed");

	return (
		<div className="space-y-6">
			{!session?.user?.isSuperAdmin && (
				<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
					<p className="text-sm text-blue-800">
						<strong>Note:</strong> You can only see and manage
						sessions that you created.
						{remainingSessions !== null &&
							` You have ${remainingSessions} session${
								remainingSessions !== 1 ? "s" : ""
							} remaining.`}
					</p>
				</div>
			)}

			{(session?.user?.isSuperAdmin || remainingSessions > 0) &&
				!activeSession && (
					<section className="bg-white rounded-2xl p-6 shadow-lg">
						<h2
							className="text-2xl font-bold mb-6"
							style={{ color: primaryDark }}
						>
							Start New Session
						</h2>

						<div className="space-y-5">
							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									What do you want to ask?
								</label>
								<input
									type="text"
									value={newPlace}
									onChange={(e) =>
										setNewPlace(e.target.value)
									}
									className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
									placeholder="e.g. 'City Name' or 'Topic'"
								/>
							</div>

							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={maxOneProposalPerUser}
										onChange={(e) =>
											setMaxOneProposalPerUser(e.target.checked)
										}
										className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										Max one proposal each
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Limit all users (including admins) to one proposal per session
								</p>
							</div>

							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={showUserCount}
										onChange={(e) =>
											setShowUserCount(e.target.checked)
										}
										className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										Show user count
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Display the number of active users in the header
								</p>
							</div>

							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={noMotivation}
										onChange={(e) =>
											setNoMotivation(e.target.checked)
										}
										className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										No motivation
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Hide problem and solution fields, only show proposal title
								</p>
							</div>

							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={singleResult}
										onChange={(e) =>
											setSingleResult(e.target.checked)
										}
										className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										Single result
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Only one winner: proposal with highest result (yes votes - no votes)
								</p>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Language
								</label>
								<select
									value={language}
									onChange={(e) =>
										setLanguage(e.target.value)
									}
									className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
								>
									<option value="sv">Svenska</option>
									<option value="en">English</option>
									<option value="sr">
										Српски (Serbian)
									</option>
									<option value="es">Español</option>
									<option value="de">Deutsch</option>
								</select>
								<p className="text-xs text-slate-500 mt-1">
									Select which language to use in the entire
									application
								</p>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Color Theme
								</label>
								<select
									value={themeValue}
									onChange={(e) =>
										setThemeValue(e.target.value)
									}
									className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
								>
									<option value="default">
										Blue/Yellow - Sweden, English (Default)
									</option>
									<option value="green">
										Green - Germany, Activism
									</option>
									<option value="red">
										Red/Gold - Spain, Serbia
									</option>
								</select>
								<p className="text-xs text-slate-500 mt-1">
									Recommendations: Swedish/English→Blue,
									German→Green, Spanish/Serbian→Red
								</p>
							</div>

							{!session?.user?.isSuperAdmin &&
								remainingSessions !== null && (
									<p className="text-sm text-slate-600 font-medium">
										Remaining sessions:{" "}
										<strong
											className="text-lg"
											style={{ color: primaryDark }}
										>
											{remainingSessions}
										</strong>
									</p>
								)}

							<button
								onClick={createSession}
								disabled={creating}
								className="px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
								style={{
									backgroundColor: accentColor,
									color: primaryDark,
								}}
							>
								{creating ? "Starting..." : "Start session"}
							</button>

							{message && (
								<div
									className={`p-4 rounded-xl font-medium ${
										message.startsWith("Error")
											? "bg-red-100 text-red-700"
											: "bg-green-100 text-green-700"
									}`}
								>
									{message}
								</div>
							)}
						</div>
					</section>
				)}

			{!session?.user?.isSuperAdmin && remainingSessions === 0 && (
				<section className="p-6 bg-yellow-50 border-2 border-yellow-300 rounded-2xl shadow-lg">
					<h2
						className="text-2xl font-bold mb-4"
						style={{ color: primaryDark }}
					>
						Request More Sessions
					</h2>
					<p className="mb-5 text-slate-700">
						You have used all your allocated sessions. How many
						additional sessions would you like to request?
					</p>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								Number of Sessions (1-50)
							</label>
							<input
								type="number"
								min="1"
								max="50"
								value={requestedSessions}
								onChange={(e) =>
									setRequestedSessions(e.target.value)
								}
								className="w-full max-w-md border-2 border-slate-300 rounded-xl px-4 py-3"
							/>
						</div>
						<button
							onClick={requestMoreSessions}
							className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-bold shadow-md hover:shadow-lg transition-all"
						>
							Submit Request
						</button>
					</div>
				</section>
			)}

			{activeSession && (
				<section className="bg-white rounded-2xl p-6 shadow-lg">
					<h2
						className="text-2xl font-bold mb-6"
						style={{ color: primaryDark }}
					>
						Active Session
					</h2>
					{activeSession.isOtherUserSession && (
						<div className="mb-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
							<p className="text-sm text-orange-800">
								<strong>Notice:</strong> This session was
								created by another admin. You cannot manage it,
								but you must wait for it to close before
								creating a new session.
							</p>
						</div>
					)}
					<div
						className={`p-5 border-2 rounded-xl space-y-4 ${
							activeSession.isOtherUserSession
								? "border-orange-300 bg-orange-50"
								: "border-green-300 bg-green-50"
						}`}
					>
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
							<div>
								<h3
									className="font-bold text-xl"
									style={{ color: primaryDark }}
								>
									{activeSession.place}
									{activeSession.isOtherUserSession && (
										<span className="ml-2 text-xs font-normal text-orange-600">
											(Created by another admin)
										</span>
									)}
								</h3>
								{activeSession.startDate && (
									<>
										<p className="text-sm text-slate-600 mt-1">
											Started:{" "}
											{new Date(
												activeSession.startDate
											).toLocaleString("sv-SE", {
												year: "numeric",
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
										<p className="text-sm text-slate-500">
											Duration:{" "}
											{Math.floor(
												(new Date() -
													new Date(
														activeSession.startDate
													)) /
													(1000 * 60 * 60)
											)}{" "}
											hours
										</p>
									</>
								)}
								<p
									className="text-sm font-bold mt-2"
									style={{ color: primaryDark }}
								>
									Current phase:{" "}
									{activeSession.phase === "phase1"
										? "Phase 1 (Rating)"
										: "Phase 2 (Debate & Voting)"}
								</p>
								{session?.user?.isSuperAdmin &&
									activeSession.createdBy &&
									activeSession.createdBy !== "other" && (
										<p className="text-xs text-slate-500 mt-1">
											Created by:{" "}
											{typeof activeSession.createdBy ===
											"object"
												? activeSession.createdBy.name
												: activeSession.createdBy}
										</p>
									)}
							</div>
							{!activeSession.isOtherUserSession &&
								(session?.user?.isSuperAdmin ||
									(typeof activeSession.createdBy === "object"
										? activeSession.createdBy._id
										: activeSession.createdBy
									)?.toString() === session?.user?.id) && (
									<button
										onClick={() =>
											closeSession(activeSession._id)
										}
										className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold shadow-md hover:shadow-lg transition-all"
									>
										Close session
									</button>
								)}
						</div>

						{!activeSession.isOtherUserSession &&
							session?.user?.isSuperAdmin &&
							activeSession.activeUsersWithStatus &&
							activeSession.activeUsersWithStatus.length > 0 && (
								<div className="mt-4 pt-4 border-t-2 border-green-200">
									<h4 className="font-bold text-sm text-slate-700 mb-3">
										Active Users (
										{
											activeSession.activeUsersWithStatus
												.length
										}
										)
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
										{activeSession.activeUsersWithStatus.map(
											(user) => (
												<div
													key={user._id}
													className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm"
												>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-semibold text-slate-900 truncate">
															{user.name}
														</p>
														<p className="text-xs text-slate-500 truncate">
															{user.email}
														</p>
													</div>
													{activeSession.phase ===
														"phase2" && (
														<div className="ml-2 flex-shrink-0">
															{user.hasVoted ? (
																<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-800">
																	✓ Voted
																</span>
															) : (
																<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-800">
																	Pending
																</span>
															)}
														</div>
													)}
												</div>
											)
										)}
									</div>
								</div>
							)}
					</div>
				</section>
			)}

			<section className="bg-white rounded-2xl p-6 shadow-lg">
				<div className="flex items-center justify-between mb-6">
					<h2
						className="text-2xl font-bold"
						style={{ color: primaryDark }}
					>
						Closed Sessions
					</h2>
					{!session?.user?.isSuperAdmin &&
						closedSessions.length > 0 && (
							<p className="text-xs text-slate-500">
								Your sessions only
							</p>
						)}
				</div>
				{closedSessions.length > 0 ? (
					<div className="space-y-3">
						{closedSessions.map((session) => {
							const startDate = new Date(session.startDate);
							const endDate = new Date(session.endDate);
							const durationHours = Math.floor(
								(endDate - startDate) / (1000 * 60 * 60)
							);
							const durationDays = Math.floor(durationHours / 24);
							const remainingHours = durationHours % 24;

							return (
								<div
									key={session._id}
									className="p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
								>
									<h3
										className="font-bold text-lg"
										style={{ color: primaryDark }}
									>
										{session.place}
									</h3>
									<p className="text-sm text-slate-600 mt-1">
										Started:{" "}
										{startDate.toLocaleString("sv-SE", {
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
									<p className="text-sm text-slate-600">
										Ended:{" "}
										{endDate.toLocaleString("sv-SE", {
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
									<p className="text-sm text-slate-500 font-medium">
										Duration:{" "}
										{durationDays > 0
											? `${durationDays}d ${remainingHours}h`
											: `${remainingHours}h`}
									</p>
								</div>
							);
						})}
					</div>
				) : (
					<p className="text-slate-500 text-center py-8">
						No closed sessions
					</p>
				)}
			</section>
		</div>
	);
}
