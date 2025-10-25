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
} from "lucide-react";

export default function AdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [tab, setTab] = useState("users");

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
				<div className="max-w-6xl mx-auto flex items-center gap-3">
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
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2">
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
		await fetch("/api/admin/users", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: editing, updates: form }),
		});
		setEditing(null);
		load();
	};
	const remove = async (id) => {
		if (!confirm("Ta bort användare? Relaterad data raderas.")) return;
		await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
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
		await fetch("/api/admin/proposals", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, updates }),
		});
		load();
	};
	const remove = async (id) => {
		if (!confirm("Ta bort förslag? Relaterade kommentarer/röster raderas."))
			return;
		await fetch(`/api/admin/proposals?id=${id}`, { method: "DELETE" });
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
		await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
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
