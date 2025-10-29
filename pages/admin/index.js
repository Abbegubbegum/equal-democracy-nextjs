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

	if (status === "loading") return <div className="p-8">Laddar…</div>;
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
								Full kontroll över data
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-medium rounded-lg transition-colors"
					>
						Tillbaka till startsidan
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2 flex-wrap">
					<Tab
						label="Sessioner"
						icon={<Calendar className="w-4 h-4" />}
						active={tab === "sessions"}
						onClick={() => setTab("sessions")}
					/>
					<Tab
						label="Toppförslag"
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
						label="Inställningar"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
					<Tab
						label="Användare"
						icon={<Users className="w-4 h-4" />}
						active={tab === "users"}
						onClick={() => setTab("users")}
					/>
					<Tab
						label="Förslag"
						icon={<FileText className="w-4 h-4" />}
						active={tab === "proposals"}
						onClick={() => setTab("proposals")}
					/>
					<Tab
						label="Kommentarer"
						icon={<MessageCircle className="w-4 h-4" />}
						active={tab === "comments"}
						onClick={() => setTab("comments")}
					/>
					<Tab
						label="Tummar upp"
						icon={<ThumbsUp className="w-4 h-4" />}
						active={tab === "thumbs"}
						onClick={() => setTab("thumbs")}
					/>
					<Tab
						label="Slutröster"
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
	const [municipalityName, setMunicipalityName] = useState("");
	const [phase2DurationHours, setPhase2DurationHours] = useState(6);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			setMunicipalityName(data.municipalityName || "");
			setPhase2DurationHours(data.phase2DurationHours || 6);
		} catch (error) {
			console.error("Error loading settings:", error);
		}
		setLoading(false);
	};

	const handleSave = async () => {
		const hours = Number(phase2DurationHours);
		if (isNaN(hours) || hours < 1 || hours > 168) {
			setMessage("Fel: Fas 2 varaktighet måste vara mellan 1 och 168 timmar");
			return;
		}

		setSaving(true);
		setMessage("");
		try {
			const res = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ municipalityName, phase2DurationHours: hours }),
			});

			if (res.ok) {
				setMessage("Inställningar sparade!");
				setTimeout(() => setMessage(""), 3000);
			} else {
				const error = await res.json();
				setMessage(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			setMessage("Kunde inte spara inställningar");
		}
		setSaving(false);
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">Inställningar</h2>

			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Kommunnamn
					</label>
					<input
						type="text"
						value={municipalityName}
						onChange={(e) => setMunicipalityName(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="T.ex. Vallentuna"
					/>
					<p className="text-sm text-slate-500 mt-1">
						Detta namn visas på startsidan: "Hur vill du förbättra [kommunnamn]?"
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Fas 2 Varaktighet (timmar)
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
						Fas 2 avslutas automatiskt när alla har röstat eller efter denna tid (1-168 timmar)
					</p>
				</div>

				<button
					onClick={handleSave}
					disabled={saving}
					className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
				>
					{saving ? "Sparar..." : "Spara inställningar"}
				</button>

				{message && (
					<div
						className={`p-3 rounded-lg ${
							message.startsWith("Fel")
								? "bg-red-100 text-red-700"
								: "bg-green-100 text-green-700"
						}`}
					>
						{message}
					</div>
				)}
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
		if (!confirm("Ta bort användare? Relaterad data raderas.")) return;
		await fetchWithCsrf(`/api/admin/users?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

	return (
		<section className="bg-white rounded-xl p-4 shadow">
			<table className="w-full text-sm">
				<thead>
					<tr className="text-left text-slate-500">
						<th>Namn</th>
						<th>E‑post</th>
						<th>Admin</th>
						<th>Skapad</th>
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
											Spara
										</button>
										<button
											onClick={cancel}
											className="px-3 py-1 rounded bg-slate-200"
										>
											Avbryt
										</button>
									</div>
								) : (
									<div className="flex gap-2 justify-end">
										<button
											onClick={() => startEdit(u)}
											className="px-3 py-1 rounded bg-slate-200"
										>
											Redigera
										</button>
										<button
											onClick={() => remove(u.id)}
											className="px-3 py-1 rounded bg-red-600 text-white"
										>
											Ta bort
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
		if (!confirm("Ta bort förslag? Relaterade kommentarer/röster raderas."))
			return;
		await fetchWithCsrf(`/api/admin/proposals?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

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
							<option value="active">Aktiv</option>
							<option value="top3">Topp 3</option>
							<option value="archived">Arkiverad</option>
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
							Ta bort
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
				["authorName", "Skribent"],
				["text", "Text"],
				["proposalTitle", "Förslag"],
				["createdAt", "Tid"],
			]}
		/>
	);
}
function ThumbsPanel() {
	return (
		<SimpleList
			endpoint="/api/admin/thumbs"
			columns={[
				["userName", "Användare"],
				["proposalTitle", "Förslag"],
				["createdAt", "Tid"],
			]}
		/>
	);
}
function VotesPanel() {
	return (
		<SimpleList
			endpoint="/api/admin/finalvotes"
			columns={[
				["userName", "Användare"],
				["proposalTitle", "Förslag"],
				["choice", "Val"],
				["createdAt", "Tid"],
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
		if (!confirm("Ta bort posten?")) return;
		await fetchWithCsrf(`${endpoint}?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

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
									Ta bort
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
	const [newSessionName, setNewSessionName] = useState("");
	const [newMunicipalityName, setNewMunicipalityName] = useState("");
	const [message, setMessage] = useState("");

	useEffect(() => {
		loadSessions();
		generateSessionName();
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

	const generateSessionName = async () => {
		// Get municipality name from settings
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			const municipality = data.municipalityName || "Vallentuna";

			// Generate date string YYMMDD
			const today = new Date();
			const year = today.getFullYear().toString().slice(-2);
			const month = (today.getMonth() + 1).toString().padStart(2, "0");
			const day = today.getDate().toString().padStart(2, "0");
			const dateStr = `${year}${month}${day}`;

			setNewSessionName(`${dateStr}-${municipality}`);
			setNewMunicipalityName(municipality);
		} catch (error) {
			console.error("Error generating session name:", error);
		}
	};

	const createSession = async () => {
		if (!newSessionName || !newMunicipalityName) {
			setMessage("Namn och kommun krävs");
			return;
		}

		setCreating(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newSessionName,
					municipalityName: newMunicipalityName,
				}),
			});

			if (res.ok) {
				setMessage("Session skapad!");
				loadSessions();
				generateSessionName();
				setTimeout(() => setMessage(""), 3000);
			} else {
				const error = await res.json();
				setMessage(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error creating session:", error);
			setMessage("Kunde inte skapa session");
		}

		setCreating(false);
	};

	const advancePhase = async () => {
		if (!confirm("Är du säker på att du vill avancera till nästa fas?")) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/sessions/advance-phase", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			if (res.ok) {
				const data = await res.json();
				alert(`Avancerat till ${data.phase}! ${data.topProposalsCount} toppförslag, ${data.archivedCount} arkiverade.`);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error advancing phase:", error);
			alert("Kunde inte avancera fas");
		}
	};

	const closeSession = async (sessionId) => {
		if (!confirm("Är du säker på att du vill avsluta denna session? Alla förslag arkiveras och vinnande förslag flyttas till toppförslag.")) {
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
				alert(`Session avslutad! ${data.topProposals.length} toppförslag sparade.`);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error closing session:", error);
			alert("Kunde inte avsluta session");
		}
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

	const activeSession = sessions.find((s) => s.status === "active");
	const closedSessions = sessions.filter((s) => s.status === "closed");

	return (
		<section className="bg-white rounded-xl p-6 shadow space-y-6">
			<div>
				<h2 className="text-xl font-bold mb-4">Skapa ny session</h2>

				{!activeSession ? (
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Sessionsnamn
							</label>
							<input
								type="text"
								value={newSessionName}
								onChange={(e) => setNewSessionName(e.target.value)}
								className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
								placeholder="251129-Vallentuna"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Kommunnamn
							</label>
							<input
								type="text"
								value={newMunicipalityName}
								onChange={(e) => setNewMunicipalityName(e.target.value)}
								className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
								placeholder="Vallentuna"
							/>
						</div>

						<button
							onClick={createSession}
							disabled={creating}
							className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
						>
							{creating ? "Skapar..." : "Skapa session"}
						</button>

						{message && (
							<div
								className={`p-3 rounded-lg ${
									message.startsWith("Fel")
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
							Det finns redan en aktiv session. Avsluta den innan du skapar en ny.
						</p>
					</div>
				)}
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Aktiv session</h2>
				{activeSession ? (
					<div className="p-4 border border-green-300 bg-green-50 rounded-lg space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-bold text-lg">{activeSession.name}</h3>
								<p className="text-sm text-slate-600">
									{activeSession.municipalityName}
								</p>
								<p className="text-sm text-slate-600">
									Startad: {new Date(activeSession.startDate).toLocaleDateString("sv-SE")}
								</p>
								<p className="text-sm font-semibold text-blue-700 mt-2">
									Aktuell fas: {activeSession.phase === "phase1" ? "Fas 1 (Betygsättning)" : "Fas 2 (Debatt & Omröstning)"}
								</p>
								{activeSession.userReadyPhase1 && activeSession.userReadyPhase1.length > 0 && (
									<p className="text-sm text-slate-600">
										{activeSession.userReadyPhase1.length} användare klara med fas 1
									</p>
								)}
							</div>
							<div className="flex flex-col gap-2">
								<button
									onClick={() => closeSession(activeSession._id)}
									className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
								>
									Avsluta session
								</button>
							</div>
						</div>
					</div>
				) : (
					<p className="text-slate-600">Ingen aktiv session</p>
				)}
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Avslutade sessioner</h2>
				{closedSessions.length > 0 ? (
					<div className="space-y-2">
						{closedSessions.map((session) => (
							<div
								key={session._id}
								className="p-4 border border-slate-200 rounded-lg"
							>
								<h3 className="font-bold">{session.name}</h3>
								<p className="text-sm text-slate-600">{session.municipalityName}</p>
								<p className="text-sm text-slate-600">
									{new Date(session.startDate).toLocaleDateString("sv-SE")} -{" "}
									{new Date(session.endDate).toLocaleDateString("sv-SE")}
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="text-slate-600">Inga avslutade sessioner</p>
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

	if (loading) return <div className="p-4 bg-white rounded-xl">Laddar…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">Toppförslag från alla sessioner</h2>

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
											<span className="font-semibold text-slate-700">Lösning:</span>
											<p className="text-slate-600">{tp.solution}</p>
										</div>
										<div>
											<span className="font-semibold text-slate-700">Kostnad:</span>
											<p className="text-slate-600">{tp.estimatedCost}</p>
										</div>
									</div>

									<div className="flex items-center gap-4 text-sm">
										<span className="text-slate-600">
											Session: <strong>{tp.sessionName}</strong>
										</span>
										<span className="text-green-700">
											👍 {tp.yesVotes} ja
										</span>
										<span className="text-red-700">
											👎 {tp.noVotes} nej
										</span>
										<span className="text-slate-600">
											Författare: {tp.authorName}
										</span>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="text-slate-600">Inga toppförslag än</p>
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
			setMessage("Välj en session");
			return;
		}

		if (!confirm("Är du säker på att du vill skicka resultat-email till alla deltagare i denna session?")) {
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
				setMessage(`Email skickad till ${data.successCount} användare! (${data.errorCount} misslyckades)`);
			} else {
				const error = await res.json();
				setMessage(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending results email:", error);
			setMessage("Kunde inte skicka email");
		}

		setSending(false);
	};

	const sendBroadcastEmail = async () => {
		if (!broadcastSubject || !broadcastMessage) {
			setMessage("Ämne och meddelande krävs");
			return;
		}

		if (!confirm("Är du säker på att du vill skicka detta email till ALLA användare?")) {
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
				setMessage(`Email skickad till ${data.successCount} användare! (${data.errorCount} misslyckades)`);
				setBroadcastSubject("");
				setBroadcastMessage("");
			} else {
				const error = await res.json();
				setMessage(`Fel: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending broadcast email:", error);
			setMessage("Kunde inte skicka email");
		}

		setSending(false);
	};

	return (
		<section className="bg-white rounded-xl p-6 shadow space-y-6">
			<div>
				<h2 className="text-xl font-bold mb-4">Skicka resultat-email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Skicka ett email till alla som deltog i en avslutad session med information om vilka förslag som vann.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Välj session
						</label>
						<select
							value={selectedSession}
							onChange={(e) => setSelectedSession(e.target.value)}
							className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
						>
							<option value="">-- Välj session --</option>
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
						{sending ? "Skickar..." : "Skicka resultat-email"}
					</button>
				</div>
			</div>

			<hr className="my-6" />

			<div>
				<h2 className="text-xl font-bold mb-4">Skicka broadcast-email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Skicka ett email till ALLA användare i systemet.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Ämne
						</label>
						<input
							type="text"
							value={broadcastSubject}
							onChange={(e) => setBroadcastSubject(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-2"
							placeholder="T.ex. Viktig information"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Meddelande
						</label>
						<textarea
							value={broadcastMessage}
							onChange={(e) => setBroadcastMessage(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-2 h-40"
							placeholder="Ditt meddelande..."
						/>
					</div>

					<button
						onClick={sendBroadcastEmail}
						disabled={sending || !broadcastSubject || !broadcastMessage}
						className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400"
					>
						{sending ? "Skickar..." : "Skicka till alla användare"}
					</button>
				</div>
			</div>

			{message && (
				<div
					className={`p-3 rounded-lg ${
						message.startsWith("Fel")
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
