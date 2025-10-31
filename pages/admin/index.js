import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
	Shield,
	Users,
	FileText,
	MessageCircle,
	ThumbsUp,
	CheckCircle,
	Settings,
	Calendar,
	Trophy,
	Mail,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";

export default function AdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [tab, setTab] = useState("sessions");

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isAdmin) router.replace("/");
	}, [status, session, router]);

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isAdmin) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-800 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
							<Shield className="w-5 h-5 text-slate-900" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">Admin</h1>
							<p className="text-slate-300 text-sm">
								Full control over data
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-medium rounded-lg transition-colors"
					>
						Back to home
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2 flex-wrap">
					<Tab
						label="Sessions"
						icon={<Calendar className="w-4 h-4" />}
						active={tab === "sessions"}
						onClick={() => setTab("sessions")}
					/>
					<Tab
						label="Top Proposals"
						icon={<Trophy className="w-4 h-4" />}
						active={tab === "top-proposals"}
						onClick={() => setTab("top-proposals")}
					/>
					<Tab
						label="Email"
						icon={<Mail className="w-4 h-4" />}
						active={tab === "email"}
						onClick={() => setTab("email")}
					/>
					<Tab
						label="Settings"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
					<Tab
						label="Users"
						icon={<Users className="w-4 h-4" />}
						active={tab === "users"}
						onClick={() => setTab("users")}
					/>
					<Tab
						label="Proposals"
						icon={<FileText className="w-4 h-4" />}
						active={tab === "proposals"}
						onClick={() => setTab("proposals")}
					/>
					<Tab
						label="Comments"
						icon={<MessageCircle className="w-4 h-4" />}
						active={tab === "comments"}
						onClick={() => setTab("comments")}
					/>
					<Tab
						label="Thumbs Up"
						icon={<ThumbsUp className="w-4 h-4" />}
						active={tab === "thumbs"}
						onClick={() => setTab("thumbs")}
					/>
					<Tab
						label="Final Votes"
						icon={<CheckCircle className="w-4 h-4" />}
						active={tab === "votes"}
						onClick={() => setTab("votes")}
					/>
				</nav>

				{tab === "sessions" && <SessionsPanel />}
				{tab === "top-proposals" && <TopProposalsPanel />}
				{tab === "email" && <EmailPanel />}
				{tab === "settings" && <SettingsPanel />}
				{tab === "users" && <UsersPanel />}
				{tab === "proposals" && <ProposalsPanel />}
				{tab === "comments" && <CommentsPanel />}
				{tab === "thumbs" && <ThumbsPanel />}
				{tab === "votes" && <VotesPanel />}
			</main>
		</div>
	);
}

function Tab({ label, icon, active, onClick }) {
	return (
		<button
			onClick={onClick}
			className={`px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 ${
				active
					? "bg-white border-slate-300 shadow"
					: "bg-slate-100 border-slate-200 hover:bg-white"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function SettingsPanel() {
	const [phase2DurationHours, setPhase2DurationHours] = useState(6);
	const [language, setLanguage] = useState("sv");
	const [theme, setTheme] = useState("default");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	const [migrating, setMigrating] = useState(false);
	const [migrationMessage, setMigrationMessage] = useState("");

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			setPhase2DurationHours(data.phase2DurationHours || 6);
			setLanguage(data.language || "sv");
			setTheme(data.theme || "default");
		} catch (error) {
			console.error("Error loading settings:", error);
		}
		setLoading(false);
	};

	const handleSave = async () => {
		const hours = Number(phase2DurationHours);
		if (isNaN(hours) || hours < 1 || hours > 168) {
			setMessage("Error: Phase 2 duration must be between 1 and 168 hours");
			return;
		}

		setSaving(true);
		setMessage("");
		try {
			const res = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					phase2DurationHours: hours,
					language,
					theme,
				}),
			});

			if (res.ok) {
				setMessage("Settings saved! Reload the page to see changes.");
				setTimeout(() => setMessage(""), 5000);
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			setMessage("Could not save settings");
		}
		setSaving(false);
	};

	const handleMigrateCommentRatings = async () => {
		if (!confirm("Do you want to migrate comment ratings? This will update all existing comments to ensure correct sorting.")) {
			return;
		}

		setMigrating(true);
		setMigrationMessage("");
		try {
			const res = await fetchWithCsrf("/api/admin/migrate-comment-ratings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			const data = await res.json();

			if (res.ok) {
				setMigrationMessage(`Success! ${data.modifiedCount} comments updated.`);
				setTimeout(() => setMigrationMessage(""), 10000);
			} else {
				setMigrationMessage(`Error: ${data.message || "Migration failed"}`);
			}
		} catch (error) {
			console.error("Error migrating comment ratings:", error);
			setMigrationMessage("Could not migrate comment ratings");
		}
		setMigrating(false);
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">Settings</h2>

			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Language
					</label>
					<select
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="sv">Svenska</option>
						<option value="en">English</option>
						<option value="sr">Српски (Serbian)</option>
						<option value="es">Español</option>
						<option value="de">Deutsch</option>
					</select>
					<p className="text-sm text-slate-500 mt-1">
						Select which language to use in the entire application
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Color Theme
					</label>
					<select
						value={theme}
						onChange={(e) => setTheme(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="default">Blue/Yellow - Sweden, English (Default)</option>
						<option value="green">Green - Germany, Activism</option>
						<option value="red">Red/Gold - Spain, Serbia</option>
					</select>
					<p className="text-sm text-slate-500 mt-1">
						Recommendations: Swedish/English→Blue, German→Green, Spanish/Serbian→Red
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Phase 2 Duration (hours)
					</label>
					<input
						type="number"
						min="1"
						max="168"
						value={phase2DurationHours}
						onChange={(e) => setPhase2DurationHours(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="6"
					/>
					<p className="text-sm text-slate-500 mt-1">
						Phase 2 ends automatically when everyone has voted or after this time (1-168 hours)
					</p>
				</div>

				<button
					onClick={handleSave}
					disabled={saving}
					className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
				>
					{saving ? "Saving..." : "Save settings"}
				</button>

				{message && (
					<div
						className={`p-3 rounded-lg ${
							message.startsWith("Error")
								? "bg-red-100 text-red-700"
								: "bg-green-100 text-green-700"
						}`}
					>
						{message}
					</div>
				)}

				{/* Migration Tools */}
				<div className="mt-8 pt-8 border-t border-slate-200">
					<h3 className="text-lg font-bold mb-4 text-slate-700">Database Migration</h3>

					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
						<h4 className="font-semibold text-yellow-800 mb-2">Migrate Comment Ratings</h4>
						<p className="text-sm text-yellow-700 mb-3">
							If arguments are not sorting correctly by rating, run this migration.
							It updates all existing comments so that sorting works.
						</p>
						<button
							onClick={handleMigrateCommentRatings}
							disabled={migrating}
							className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
						>
							{migrating ? "Migrating..." : "Run migration"}
						</button>
					</div>

					{migrationMessage && (
						<div
							className={`p-3 rounded-lg ${
								migrationMessage.startsWith("Error")
									? "bg-red-100 text-red-700"
									: "bg-green-100 text-green-700"
							}`}
						>
							{migrationMessage}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

function UsersPanel() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState({ name: "", email: "", isAdmin: false });

	const load = async () => {
		setLoading(true);
		const res = await fetch("/api/admin/users");
		const data = await res.json();
		setItems(data);
		setLoading(false);
	};
	useEffect(() => {
		load();
	}, []);

	const startEdit = (u) => {
		setEditing(u.id);
		setForm({ name: u.name, email: u.email, isAdmin: !!u.isAdmin });
	};
	const cancel = () => {
		setEditing(null);
	};
	const save = async () => {
		await fetchWithCsrf("/api/admin/users", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: editing, updates: form }),
		});
		setEditing(null);
		load();
	};
	const remove = async (id) => {
		if (!confirm("Delete user? Related data will be deleted.")) return;
		await fetchWithCsrf(`/api/admin/users?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-4 shadow">
			<table className="w-full text-sm">
				<thead>
					<tr className="text-left text-slate-500">
						<th>Name</th>
						<th>Email</th>
						<th>Admin</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{items.map((u) => (
						<tr key={u.id} className="border-t">
							<td>
								{editing === u.id ? (
									<input
										className="border rounded px-2 py-1"
										value={form.name}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												name: e.target.value,
											}))
										}
									/>
								) : (
									u.name
								)}
							</td>
							<td>
								{editing === u.id ? (
									<input
										className="border rounded px-2 py-1"
										value={form.email}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												email: e.target.value,
											}))
										}
									/>
								) : (
									u.email
								)}
							</td>
							<td>
								{editing === u.id ? (
									<input
										type="checkbox"
										checked={form.isAdmin}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												isAdmin: e.target.checked,
											}))
										}
									/>
								) : u.isAdmin ? (
									"✓"
								) : (
									"–"
								)}
							</td>
							<td>
								{new Date(u.createdAt).toLocaleString("sv-SE")}
							</td>
							<td className="text-right">
								{editing === u.id ? (
									<div className="flex gap-2 justify-end">
										<button
											onClick={save}
											className="px-3 py-1 rounded bg-green-600 text-white"
										>
											Save
										</button>
										<button
											onClick={cancel}
											className="px-3 py-1 rounded bg-slate-200"
										>
											Cancel
										</button>
									</div>
								) : (
									<div className="flex gap-2 justify-end">
										<button
											onClick={() => startEdit(u)}
											className="px-3 py-1 rounded bg-slate-200"
										>
											Edit
										</button>
										<button
											onClick={() => remove(u.id)}
											className="px-3 py-1 rounded bg-red-600 text-white"
										>
											Delete
										</button>
									</div>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

function ProposalsPanel() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		const res = await fetch("/api/admin/proposals");
		setItems(await res.json());
		setLoading(false);
	};
	useEffect(() => {
		load();
	}, []);

	const patch = async (id, updates) => {
		await fetchWithCsrf("/api/admin/proposals", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, updates }),
		});
		load();
	};
	const remove = async (id) => {
		if (!confirm("Delete proposal? Related comments/votes will be deleted."))
			return;
		await fetchWithCsrf(`/api/admin/proposals?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-4 shadow space-y-2">
			{items.map((p) => (
				<div key={p.id} className="border rounded-xl p-3">
					<div className="flex items-center justify-between">
						<input
							className="font-semibold text-blue-900 flex-1 mr-3 border rounded px-2 py-1"
							defaultValue={p.title}
							onBlur={(e) =>
								patch(p.id, { title: e.target.value })
							}
						/>
						<select
							defaultValue={p.status}
							onChange={(e) =>
								patch(p.id, { status: e.target.value })
							}
							className="border rounded px-2 py-1"
						>
							<option value="active">Active</option>
							<option value="top3">Top Proposals</option>
							<option value="archived">Archived</option>
						</select>
					</div>
					<textarea
						className="mt-2 w-full border rounded px-2 py-1"
						defaultValue={p.description}
						onBlur={(e) =>
							patch(p.id, { description: e.target.value })
						}
					/>
					<div className="mt-2 flex items-center justify-between text-sm text-slate-600">
						<div>
							👍 {p.thumbsUpCount} • {p.authorName}
						</div>
						<button
							onClick={() => remove(p.id)}
							className="px-3 py-1 rounded bg-red-600 text-white"
						>
							Delete
						</button>
					</div>
				</div>
			))}
		</section>
	);
}

function CommentsPanel() {
	return (
		<SimpleList
			endpoint="/api/admin/comments"
			columns={[
				["authorName", "Author"],
				["text", "Text"],
				["proposalTitle", "Proposal"],
				["createdAt", "Time"],
			]}
		/>
	);
}
function ThumbsPanel() {
	return (
		<SimpleList
			endpoint="/api/admin/thumbs"
			columns={[
				["userName", "User"],
				["proposalTitle", "Proposal"],
				["createdAt", "Time"],
			]}
		/>
	);
}
function VotesPanel() {
	return (
		<SimpleList
			endpoint="/api/admin/finalvotes"
			columns={[
				["userName", "User"],
				["proposalTitle", "Proposal"],
				["choice", "Choice"],
				["createdAt", "Time"],
			]}
		/>
	);
}

function SimpleList({ endpoint, columns }) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		const res = await fetch(endpoint);
		setRows(await res.json());
		setLoading(false);
	};
	useEffect(() => {
		load();
	}, []);

	const remove = async (id) => {
		if (!confirm("Delete this entry?")) return;
		await fetchWithCsrf(`${endpoint}?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-4 shadow overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="text-left text-slate-500">
						{columns.map(([key, label]) => (
							<th key={key} className="pr-4">
								{label}
							</th>
						))}
						<th></th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.id} className="border-t">
							{columns.map(([key]) => (
								<td key={key} className="pr-4 py-2">
									{key === "createdAt"
										? new Date(r[key]).toLocaleString(
												"sv-SE"
										  )
										: String(r[key] ?? "")}
								</td>
							))}
							<td className="text-right">
								<button
									onClick={() => remove(r.id)}
									className="px-3 py-1 rounded bg-red-600 text-white"
								>
									Delete
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

function SessionsPanel() {
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newPlace, setNewPlace] = useState("");
	const [message, setMessage] = useState("");

	useEffect(() => {
		loadSessions();
		setNewPlace("Vallentuna");
	}, []);

	const loadSessions = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/sessions");
			const data = await res.json();
			setSessions(data);
		} catch (error) {
			console.error("Error loading sessions:", error);
		}
		setLoading(false);
	};

	const createSession = async () => {
		if (!newPlace) {
			setMessage("Place required");
			return;
		}

		setCreating(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					place: newPlace,
				}),
			});

			if (res.ok) {
				setMessage("Session created!");
				loadSessions();
				setNewPlace("Vallentuna");
				setTimeout(() => setMessage(""), 3000);
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

	const advancePhase = async () => {
		if (!confirm("Are you sure you want to advance to the next phase?")) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/sessions/advance-phase", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			if (res.ok) {
				const data = await res.json();
				alert(`Advanced to ${data.phase}! ${data.topProposalsCount} top proposals, ${data.archivedCount} archived.`);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error advancing phase:", error);
			alert("Could not advance phase");
		}
	};

	const closeSession = async (sessionId) => {
		if (!confirm("Are you sure you want to close this session? All proposals will be archived and winning proposals moved to top proposals.")) {
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
				alert(`Session closed! ${data.topProposals.length} top proposals saved.`);
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

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	const activeSession = sessions.find((s) => s.status === "active");
	const closedSessions = sessions.filter((s) => s.status === "closed");

	return (
		<section className="bg-white rounded-xl p-6 shadow space-y-6">
			<div>
				<h2 className="text-xl font-bold mb-4">Create New Session</h2>

				{!activeSession ? (
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Place Name
							</label>
							<input
								type="text"
								value={newPlace}
								onChange={(e) => setNewPlace(e.target.value)}
								className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
								placeholder="Vallentuna"
							/>
						</div>

						<button
							onClick={createSession}
							disabled={creating}
							className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
						>
							{creating ? "Creating..." : "Create session"}
						</button>

						{message && (
							<div
								className={`p-3 rounded-lg ${
									message.startsWith("Error")
										? "bg-red-100 text-red-700"
										: "bg-green-100 text-green-700"
								}`}
							>
								{message}
							</div>
						)}
					</div>
				) : (
					<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
						<p className="text-yellow-800">
							There is already an active session. Close it before creating a new one.
						</p>
					</div>
				)}
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Active Session</h2>
				{activeSession ? (
					<div className="p-4 border border-green-300 bg-green-50 rounded-lg space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-bold text-lg">{activeSession.place}</h3>
								<p className="text-sm text-slate-600">
									Started: {new Date(activeSession.startDate).toLocaleString("sv-SE", {
										year: 'numeric',
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</p>
								<p className="text-sm text-slate-500">
									Duration: {Math.floor((new Date() - new Date(activeSession.startDate)) / (1000 * 60 * 60))} hours
								</p>
								<p className="text-sm font-semibold text-blue-700 mt-2">
									Current phase: {activeSession.phase === "phase1" ? "Phase 1 (Rating)" : "Phase 2 (Debate & Voting)"}
								</p>
								{activeSession.userReadyPhase1 && activeSession.userReadyPhase1.length > 0 && (
									<p className="text-sm text-slate-600">
										{activeSession.userReadyPhase1.length} users ready with phase 1
									</p>
								)}
							</div>
							<div className="flex flex-col gap-2">
								<button
									onClick={() => closeSession(activeSession._id)}
									className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
								>
									Close session
								</button>
							</div>
						</div>
					</div>
				) : (
					<p className="text-slate-600">No active session</p>
				)}
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Closed Sessions</h2>
				{closedSessions.length > 0 ? (
					<div className="space-y-2">
						{closedSessions.map((session) => {
							const startDate = new Date(session.startDate);
							const endDate = new Date(session.endDate);
							const durationHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
							const durationDays = Math.floor(durationHours / 24);
							const remainingHours = durationHours % 24;

							return (
								<div
									key={session._id}
									className="p-4 border border-slate-200 rounded-lg"
								>
									<h3 className="font-bold text-lg">{session.place}</h3>
									<p className="text-sm text-slate-600">
										Started: {startDate.toLocaleString("sv-SE", {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
									<p className="text-sm text-slate-600">
										Ended: {endDate.toLocaleString("sv-SE", {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
									<p className="text-sm text-slate-500">
										Duration: {durationDays > 0 ? `${durationDays}d ${remainingHours}h` : `${remainingHours}h`}
									</p>
								</div>
							);
						})}
					</div>
				) : (
					<p className="text-slate-600">No closed sessions</p>
				)}
			</div>
		</section>
	);
}

function TopProposalsPanel() {
	const [topProposals, setTopProposals] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadTopProposals();
	}, []);

	const loadTopProposals = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/top-proposals");
			const data = await res.json();
			setTopProposals(data);
		} catch (error) {
			console.error("Error loading top proposals:", error);
		}
		setLoading(false);
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">Top Proposals from All Sessions</h2>

			{topProposals.length > 0 ? (
				<div className="space-y-4">
					{topProposals.map((tp) => (
						<div
							key={tp.id}
							className="p-4 border-l-4 border-yellow-400 bg-yellow-50 rounded-lg"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<h3 className="font-bold text-lg text-blue-900">
											{tp.title}
										</h3>
									</div>

									<div className="space-y-2 text-sm mb-3">
										<div>
											<span className="font-semibold text-slate-700">Problem:</span>
											<p className="text-slate-600">{tp.problem}</p>
										</div>
										<div>
											<span className="font-semibold text-slate-700">Solution:</span>
											<p className="text-slate-600">{tp.solution}</p>
										</div>
										<div>
											<span className="font-semibold text-slate-700">Cost:</span>
											<p className="text-slate-600">{tp.estimatedCost}</p>
										</div>
									</div>

									<div className="flex items-center gap-4 text-sm">
										<span className="text-slate-600">
											Place: <strong>{tp.sessionPlace}</strong> • {new Date(tp.sessionStartDate).toLocaleDateString("sv-SE")}
										</span>
										<span className="text-green-700">
											👍 {tp.yesVotes} yes
										</span>
										<span className="text-red-700">
											👎 {tp.noVotes} no
										</span>
										<span className="text-slate-600">
											Author: {tp.authorName}
										</span>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="text-slate-600">No top proposals yet</p>
			)}
		</section>
	);
}

function EmailPanel() {
	const [sessions, setSessions] = useState([]);
	const [selectedSession, setSelectedSession] = useState("");
	const [broadcastSubject, setBroadcastSubject] = useState("");
	const [broadcastMessage, setBroadcastMessage] = useState("");
	const [sending, setSending] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		loadSessions();
	}, []);

	const loadSessions = async () => {
		try {
			const res = await fetch("/api/admin/sessions");
			const data = await res.json();
			setSessions(data.filter((s) => s.status === "closed"));
		} catch (error) {
			console.error("Error loading sessions:", error);
		}
	};

	const sendResultsEmail = async () => {
		if (!selectedSession) {
			setMessage("Select a session");
			return;
		}

		if (!confirm("Are you sure you want to send results email to all participants in this session?")) {
			return;
		}

		setSending(true);
		setMessage("");

		try{
			const res = await fetchWithCsrf("/api/admin/send-results-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId: selectedSession }),
			});

			if (res.ok) {
				const data = await res.json();
				setMessage(`Email sent to ${data.successCount} users! (${data.errorCount} failed)`);
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending results email:", error);
			setMessage("Could not send email");
		}

		setSending(false);
	};

	const sendBroadcastEmail = async () => {
		if (!broadcastSubject || !broadcastMessage) {
			setMessage("Subject and message required");
			return;
		}

		if (!confirm("Are you sure you want to send this email to ALL users?")) {
			return;
		}

		setSending(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/send-broadcast-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					subject: broadcastSubject,
					message: broadcastMessage,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				setMessage(`Email sent to ${data.successCount} users! (${data.errorCount} failed)`);
				setBroadcastSubject("");
				setBroadcastMessage("");
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending broadcast email:", error);
			setMessage("Could not send email");
		}

		setSending(false);
	};

	return (
		<section className="bg-white rounded-xl p-6 shadow space-y-6">
			<div>
				<h2 className="text-xl font-bold mb-4">Send Results Email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Send an email to all participants in a closed session with information about which proposals won.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Select Session
						</label>
						<select
							value={selectedSession}
							onChange={(e) => setSelectedSession(e.target.value)}
							className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
						>
							<option value="">-- Select session --</option>
							{sessions.map((s) => (
								<option key={s._id} value={s._id}>
									{s.name}
								</option>
							))}
						</select>
					</div>

					<button
						onClick={sendResultsEmail}
						disabled={sending || !selectedSession}
						className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
					>
						{sending ? "Sending..." : "Send results email"}
					</button>
				</div>
			</div>

			<hr className="my-6" />

			<div>
				<h2 className="text-xl font-bold mb-4">Send Broadcast Email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Send an email to ALL users in the system.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Subject
						</label>
						<input
							type="text"
							value={broadcastSubject}
							onChange={(e) => setBroadcastSubject(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-2"
							placeholder="e.g. Important information"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Message
						</label>
						<textarea
							value={broadcastMessage}
							onChange={(e) => setBroadcastMessage(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-2 h-40"
							placeholder="Your message..."
						/>
					</div>

					<button
						onClick={sendBroadcastEmail}
						disabled={sending || !broadcastSubject || !broadcastMessage}
						className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400"
					>
						{sending ? "Sending..." : "Send to all users"}
					</button>
				</div>
			</div>

			{message && (
				<div
					className={`p-3 rounded-lg ${
						message.startsWith("Error")
							? "bg-red-100 text-red-700"
							: "bg-green-100 text-green-700"
					}`}
				>
					{message}
				</div>
			)}
		</section>
	);
}
