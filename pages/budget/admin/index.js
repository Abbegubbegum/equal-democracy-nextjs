import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Wallet, Upload, List, Settings } from "lucide-react";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";

export default function BudgetAdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [tab, setTab] = useState("sessions");

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isSuperAdmin) router.replace("/");
	}, [status, session, router]);

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isSuperAdmin) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-emerald-800 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-emerald-400 rounded-full flex items-center justify-center">
							<Wallet className="w-5 h-5 text-emerald-900" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">Budget Admin</h1>
							<p className="text-emerald-200 text-sm">
								Manage median budget voting sessions
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-white hover:bg-gray-100 text-emerald-900 font-medium rounded-lg transition-colors shadow-sm"
					>
						Back to home
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2 flex-wrap">
					<Tab
						label="Sessions"
						icon={<List className="w-4 h-4" />}
						active={tab === "sessions"}
						onClick={() => setTab("sessions")}
					/>
					<Tab
						label="Upload PDFs"
						icon={<Upload className="w-4 h-4" />}
						active={tab === "upload"}
						onClick={() => setTab("upload")}
					/>
					<Tab
						label="Settings"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
				</nav>

				{tab === "sessions" && <SessionsPanel />}
				{tab === "upload" && <UploadPanel />}
				{tab === "settings" && <SettingsPanel />}
			</main>
		</div>
	);
}

function Tab({ label, icon, active, onClick }) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
				active
					? "bg-emerald-100 text-emerald-900 border-2 border-emerald-500"
					: "bg-white text-gray-700 border-2 border-gray-200 hover:border-emerald-300"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function SessionsPanel() {
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const router = useRouter();

	useEffect(() => {
		fetchSessions();
	}, []);

	async function fetchSessions() {
		try {
			setLoading(true);
			const response = await fetch("/api/budget/sessions");
			const data = await response.json();

			if (response.ok) {
				setSessions(data.sessions);
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError("Failed to fetch sessions");
		} finally {
			setLoading(false);
		}
	}

	async function handleStatusChange(sessionId, newStatus) {
		try {
			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId, status: newStatus }),
			});

			const data = await response.json();

			if (response.ok) {
				fetchSessions();
			} else {
				alert(data.message);
			}
		} catch (err) {
			alert("Failed to update session status");
		}
	}

	async function handleDelete(sessionId) {
		if (!confirm("Are you sure you want to delete this session?")) return;

		try {
			const response = await fetchWithCsrf(
				`/api/budget/sessions?sessionId=${sessionId}`,
				{ method: "DELETE" }
			);

			const data = await response.json();

			if (response.ok) {
				fetchSessions();
			} else {
				alert(data.message);
			}
		} catch (err) {
			alert("Failed to delete session");
		}
	}

	if (loading) return <div className="text-center p-8">Loading sessions...</div>;

	return (
		<div className="bg-white rounded-xl shadow-sm p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-bold text-gray-900">Budget Sessions</h2>
				<button
					onClick={() => setShowCreateForm(!showCreateForm)}
					className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
				>
					{showCreateForm ? "Cancel" : "Create New Session"}
				</button>
			</div>

			{error && (
				<div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			{showCreateForm && (
				<CreateSessionForm
					onSuccess={() => {
						setShowCreateForm(false);
						fetchSessions();
					}}
					onCancel={() => setShowCreateForm(false)}
				/>
			)}

			<div className="space-y-4 mt-6">
				{sessions.length === 0 ? (
					<p className="text-gray-500 text-center py-8">
						No budget sessions yet. Create one to get started.
					</p>
				) : (
					sessions.map((session) => (
						<SessionCard
							key={session._id}
							session={session}
							onStatusChange={handleStatusChange}
							onDelete={handleDelete}
						/>
					))
				)}
			</div>
		</div>
	);
}

function SessionCard({ session, onStatusChange, onDelete }) {
	const router = useRouter();
	const statusColors = {
		draft: "bg-gray-100 text-gray-700",
		active: "bg-green-100 text-green-700",
		closed: "bg-blue-100 text-blue-700",
	};

	return (
		<div className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition-colors">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						<h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
						<span
							className={`px-2 py-1 rounded-full text-xs font-medium ${
								statusColors[session.status]
							}`}
						>
							{session.status}
						</span>
					</div>
					<p className="text-sm text-gray-600 mb-2">{session.municipality}</p>
					<p className="text-sm text-gray-500">
						Total Budget: {(session.totalBudget / 1000000).toFixed(1)} mnkr
					</p>
					<p className="text-sm text-gray-500">
						Categories: {session.categories?.length || 0} |{" "}
						Income sources: {session.incomeCategories?.length || 0}
					</p>
				</div>
				<div className="flex flex-col gap-2">
					{session.status === "draft" && (
						<button
							onClick={() => onStatusChange(session._id, "active")}
							className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
						>
							Activate
						</button>
					)}
					{session.status === "active" && (
						<button
							onClick={() => onStatusChange(session._id, "closed")}
							className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
						>
							Close Voting
						</button>
					)}
					{session.status === "closed" && (
						<button
							onClick={() => router.push(`/budget/results/${session._id}`)}
							className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
						>
							View Results
						</button>
					)}
					{session.status === "draft" && (
						<button
							onClick={() => onDelete(session._id)}
							className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
						>
							Delete
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

function CreateSessionForm({ onSuccess, onCancel }) {
	const [formData, setFormData] = useState({
		name: "",
		municipality: "",
		totalBudget: "",
	});
	const [categories, setCategories] = useState([]);
	const [incomeCategories, setIncomeCategories] = useState([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");

		if (categories.length === 0) {
			setError("Please add at least one expense category");
			return;
		}

		if (incomeCategories.length === 0) {
			setError("Please add at least one income category");
			return;
		}

		try {
			setSubmitting(true);

			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					totalBudget: parseFloat(formData.totalBudget) * 1000000, // Convert mnkr to kr
					categories,
					incomeCategories,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				onSuccess();
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError("Failed to create session");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
			<h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Session</h3>

			{error && (
				<div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Session Name
				</label>
				<input
					type="text"
					value={formData.name}
					onChange={(e) => setFormData({ ...formData, name: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Vallentuna Budget 2025"
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Municipality
				</label>
				<input
					type="text"
					value={formData.municipality}
					onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Vallentuna"
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Total Budget (mnkr)
				</label>
				<input
					type="number"
					step="0.1"
					value={formData.totalBudget}
					onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="2100"
					required
				/>
			</div>

			<div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
				<p className="font-medium mb-2">Note:</p>
				<p>
					Use the "Upload PDFs" tab to extract budget data from PDF documents, then
					come back here to create a session with that data. Or manually add categories
					below.
				</p>
			</div>

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					{submitting ? "Creating..." : "Create Session"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function UploadPanel() {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [extractedData, setExtractedData] = useState(null);
	const [documentType, setDocumentType] = useState("expenses");

	async function handleUpload(e) {
		e.preventDefault();
		setError("");
		setSuccess("");
		setExtractedData(null);

		const file = e.target.querySelector('input[type="file"]').files[0];
		if (!file) {
			setError("Please select a PDF file");
			return;
		}

		try {
			setUploading(true);

			const formData = new FormData();
			formData.append("pdf", file);
			formData.append("documentType", documentType);

			const response = await fetch("/api/budget/upload-pdf", {
				method: "POST",
				body: formData,
			});

			const data = await response.json();

			if (response.ok) {
				setSuccess("PDF processed successfully! Copy the data below to use in a new session.");
				setExtractedData(data.data);
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError("Failed to upload and process PDF");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="bg-white rounded-xl shadow-sm p-6">
			<h2 className="text-xl font-bold text-gray-900 mb-6">Upload Budget PDFs</h2>

			<form onSubmit={handleUpload} className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Document Type
					</label>
					<select
						value={documentType}
						onChange={(e) => setDocumentType(e.target.value)}
						className="w-full p-2 border border-gray-300 rounded-lg"
					>
						<option value="expenses">Expenses (Driftredovisning)</option>
						<option value="income">Income (Intäkter & Bidrag)</option>
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						PDF File
					</label>
					<input
						type="file"
						accept=".pdf"
						className="w-full p-2 border border-gray-300 rounded-lg"
						required
					/>
				</div>

				<button
					type="submit"
					disabled={uploading}
					className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					{uploading ? "Processing..." : "Upload and Extract"}
				</button>
			</form>

			{error && (
				<div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			{success && (
				<div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
					{success}
				</div>
			)}

			{extractedData && (
				<div className="mt-6">
					<h3 className="text-lg font-semibold text-gray-900 mb-2">Extracted Data</h3>
					<pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm">
						{JSON.stringify(extractedData, null, 2)}
					</pre>
					<button
						onClick={() => {
							navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
							alert("Copied to clipboard!");
						}}
						className="mt-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
					>
						Copy to Clipboard
					</button>
				</div>
			)}
		</div>
	);
}

function SettingsPanel() {
	return (
		<div className="bg-white rounded-xl shadow-sm p-6">
			<h2 className="text-xl font-bold text-gray-900 mb-6">Budget Settings</h2>
			<p className="text-gray-600">Budget-specific settings will appear here.</p>
		</div>
	);
}
