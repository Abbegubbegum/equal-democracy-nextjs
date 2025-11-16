import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Wallet, List, Settings } from "lucide-react";
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
								AI-powered median budget voting sessions
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
						label="Settings"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
				</nav>

				{tab === "sessions" && <SessionsPanel />}
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

	async function handleStatusChange(session, newStatus) {
		try {
			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId: session.sessionId, status: newStatus }),
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

	async function handleDelete(session) {
		if (!confirm("Are you sure you want to delete this session?")) return;

		try {
			const response = await fetchWithCsrf(
				`/api/budget/sessions?sessionId=${session.sessionId}`,
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

	const displayId = session.sessionId;

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
					<p className="text-xs text-gray-400 mb-2 font-mono">ID: {displayId}</p>
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
							onClick={() => onStatusChange(session, "active")}
							className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
						>
							Activate
						</button>
					)}
					{session.status === "active" && (
						<button
							onClick={() => onStatusChange(session, "closed")}
							className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
						>
							Close Voting
						</button>
					)}
					{session.status === "closed" && (
						<button
							onClick={() => router.push(`/budget/results/${displayId}`)}
							className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
						>
							View Results
						</button>
					)}
					{session.status === "draft" && (
						<button
							onClick={() => onDelete(session)}
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
		description: "",
	});
	const [expensesPdf, setExpensesPdf] = useState(null);
	const [incomePdf, setIncomePdf] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState("");
	const [uploadStatus, setUploadStatus] = useState("");

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setUploadStatus("");

		if (!expensesPdf && !incomePdf) {
			setError("Please upload at least one PDF file (expenses or income)");
			return;
		}

		try {
			setSubmitting(true);
			setProcessing(true);

			// Step 1: Extract data from expenses PDF
			let expensesData = null;
			if (expensesPdf) {
				setUploadStatus("Processing expenses PDF with AI...");
				const expensesFormData = new FormData();
				expensesFormData.append("pdf", expensesPdf);
				expensesFormData.append("documentType", "expenses");

				const expensesResponse = await fetch("/api/budget/upload-pdf", {
					method: "POST",
					body: expensesFormData,
				});

				const expensesResult = await expensesResponse.json();
				if (!expensesResponse.ok) {
					throw new Error(expensesResult.message || "Failed to process expenses PDF");
				}
				expensesData = expensesResult.data;
			}

			// Step 2: Extract data from income PDF
			let incomeData = null;
			if (incomePdf) {
				setUploadStatus("Processing income PDF with AI...");
				const incomeFormData = new FormData();
				incomeFormData.append("pdf", incomePdf);
				incomeFormData.append("documentType", "income");

				const incomeResponse = await fetch("/api/budget/upload-pdf", {
					method: "POST",
					body: incomeFormData,
				});

				const incomeResult = await incomeResponse.json();
				if (!incomeResponse.ok) {
					throw new Error(incomeResult.message || "Failed to process income PDF");
				}
				incomeData = incomeResult.data;
			}

			// Step 3: Create budget session with extracted data
			setUploadStatus("Creating budget session...");

			const totalBudget = expensesData?.totalBudget || incomeData?.totalIncome || 0;
			const categories = expensesData?.categories || [];
			const incomeCategories = incomeData?.incomeCategories || [];

			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					municipality: formData.municipality,
					totalBudget,
					categories,
					incomeCategories,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				setUploadStatus("Session created successfully!");
				setTimeout(() => onSuccess(), 1000);
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError(err.message || "Failed to create session");
			console.error("Error creating session:", err);
		} finally {
			setSubmitting(false);
			setProcessing(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
			<h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Budget Session</h3>

			{error && (
				<div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			{uploadStatus && (
				<div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
					{uploadStatus}
				</div>
			)}

			<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
				<p className="font-medium mb-2">How it works:</p>
				<ol className="list-decimal list-inside space-y-1">
					<li>Upload PDF(s) with budget data (expenses and/or income)</li>
					<li>AI extracts all categories and amounts automatically</li>
					<li>Budget session is created and ready for voting</li>
				</ol>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Session Name *
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
					Municipality / Organization *
				</label>
				<input
					type="text"
					value={formData.municipality}
					onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Vallentuna kommun, Företag AB, etc."
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Description (optional)
				</label>
				<textarea
					value={formData.description}
					onChange={(e) => setFormData({ ...formData, description: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Brief description of this budget session..."
					rows={2}
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Expenses PDF (Driftredovisning)
					</label>
					<input
						type="file"
						accept=".pdf"
						onChange={(e) => setExpensesPdf(e.target.files[0])}
						className="w-full p-2 border border-gray-300 rounded-lg"
					/>
					{expensesPdf && (
						<p className="text-xs text-green-600 mt-1">
							✓ {expensesPdf.name}
						</p>
					)}
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Income PDF (Intäkter & Bidrag)
					</label>
					<input
						type="file"
						accept=".pdf"
						onChange={(e) => setIncomePdf(e.target.files[0])}
						className="w-full p-2 border border-gray-300 rounded-lg"
					/>
					{incomePdf && (
						<p className="text-xs text-green-600 mt-1">
							✓ {incomePdf.name}
						</p>
					)}
				</div>
			</div>

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
				>
					{processing && (
						<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
					)}
					{submitting ? "Creating Session..." : "Create Session with AI"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</form>
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
