import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, Save, Info } from "lucide-react";
import SimpleTreemap from "../../components/budget/SimpleTreemap";
import CategoryInput from "../../components/budget/CategoryInput";
import IncomeCategoryInput from "../../components/budget/IncomeCategoryInput";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";

export default function BudgetVotingPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { sessionId } = router.query;

	const [budgetSession, setBudgetSession] = useState(null);
	const [allocations, setAllocations] = useState([]);
	const [incomeAllocations, setIncomeAllocations] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [showInfo, setShowInfo] = useState(true);

	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
			return;
		}
		if (sessionId) {
			fetchBudgetSession();
			fetchExistingVote();
		}
	}, [status, session, sessionId]);

	async function fetchBudgetSession() {
		try {
			setLoading(true);
			const response = await fetch(`/api/budget/sessions`);
			const data = await response.json();

			if (response.ok) {
				const foundSession = data.sessions.find((s) => s.sessionId === sessionId);
				if (foundSession) {
					setBudgetSession(foundSession);
					initializeAllocations(foundSession);
				} else {
					setError("Session not found");
				}
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError("Failed to fetch budget session");
		} finally {
			setLoading(false);
		}
	}

	async function fetchExistingVote() {
		try {
			const response = await fetch(`/api/budget/vote?sessionId=${sessionId}`);

			if (response.ok) {
				const data = await response.json();
				setAllocations(data.vote.allocations);
				setIncomeAllocations(data.vote.incomeAllocations);
			}
		} catch (err) {
			// No existing vote, that's okay
		}
	}

	function initializeAllocations(session) {
		// Initialize allocations with default values
		if (allocations.length === 0) {
			const defaultAllocations = session.categories.map((cat) => ({
				categoryId: cat.id,
				amount: cat.defaultAmount,
				subcategories: [],
			}));
			setAllocations(defaultAllocations);
		}

		if (incomeAllocations.length === 0) {
			const defaultIncomeAllocations = session.incomeCategories.map((cat) => {
				// For tax income, calculate default tax rate if not provided
				const isTaxIncome = cat.isTaxRate || cat.name.toLowerCase().includes("skatt");
				let taxRateKr = cat.taxRateKr || 19; // Default 19 kr

				// If we have amount and taxBase, calculate the rate
				if (isTaxIncome && session.taxBase && cat.amount) {
					taxRateKr = cat.amount / session.taxBase;
				}

				return {
					categoryId: cat.id,
					amount: cat.amount,
					taxRateKr: isTaxIncome ? taxRateKr : undefined,
				};
			});
			setIncomeAllocations(defaultIncomeAllocations);
		}
	}

	function updateAllocation(categoryId, newAmount) {
		setAllocations((prev) => {
			const existing = prev.find((a) => a.categoryId === categoryId);
			if (existing) {
				return prev.map((a) =>
					a.categoryId === categoryId ? { ...a, amount: newAmount } : a
				);
			} else {
				return [
					...prev,
					{ categoryId, amount: newAmount, subcategories: [] },
				];
			}
		});
	}

	function updateIncomeAllocation(categoryId, newAmount, taxRateKr) {
		setIncomeAllocations((prev) => {
			const existing = prev.find((a) => a.categoryId === categoryId);
			if (existing) {
				return prev.map((a) =>
					a.categoryId === categoryId
						? { ...a, amount: newAmount, taxRateKr: taxRateKr || a.taxRateKr }
						: a
				);
			} else {
				return [...prev, { categoryId, amount: newAmount, taxRateKr }];
			}
		});
	}

	async function handleSaveVote() {
		setError("");
		setSuccess("");

		try {
			setSaving(true);

			const totalExpenses = allocations.reduce((sum, a) => sum + a.amount, 0);
			const totalIncome = incomeAllocations.reduce((sum, a) => sum + a.amount, 0);

			const response = await fetchWithCsrf("/api/budget/vote", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					allocations,
					incomeAllocations,
					totalExpenses,
					totalIncome,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				setSuccess("Your budget proposal has been saved successfully!");
				setTimeout(() => setSuccess(""), 3000);
			} else {
				setError(data.message);
				if (data.errors) {
					setError(data.errors.join(", "));
				}
			}
		} catch (err) {
			setError("Failed to save vote");
		} finally {
			setSaving(false);
		}
	}

	const totalExpenses = allocations.reduce((sum, a) => sum + a.amount, 0);
	const totalIncome = incomeAllocations.reduce((sum, a) => sum + a.amount, 0);
	const balance = totalIncome - totalExpenses;
	const isBalanced = Math.abs(balance) < 1000000; // Within 1 mnkr

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<p className="text-gray-600">Loading budget session...</p>
			</div>
		);
	}

	if (error && !budgetSession) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-red-600 mb-4">{error}</p>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
					>
						Go Back
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-emerald-800 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<button
							onClick={() => router.push("/")}
							className="flex items-center gap-2 text-emerald-200 hover:text-white"
						>
							<ArrowLeft className="w-4 h-4" />
							Back
						</button>
						{session?.user?.isSuperAdmin && (
							<button
								onClick={() => router.push("/budget/admin")}
								className="text-emerald-200 hover:text-white font-medium"
							>
								Budget Admin
							</button>
						)}
					</div>
					<h1 className="text-2xl font-bold">
						Budget Voting for {budgetSession?.name}
					</h1>
					<p className="text-emerald-200 text-sm mt-1">
						{budgetSession?.municipality}
					</p>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				{showInfo && (
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
							<div className="flex-1">
								<h3 className="font-semibold text-blue-900 mb-2">
									How Budget Voting Works
								</h3>
								<ul className="text-sm text-blue-800 space-y-1">
									<li>• Adjust budget allocations by dragging on the treemap or entering amounts</li>
									<li>• Patterned areas show unavoidable minimums that cannot be reduced</li>
									<li>• Your total expenses should match your total income</li>
									<li>• After voting closes, the median of all proposals becomes the collective budget</li>
								</ul>
							</div>
							<button
								onClick={() => setShowInfo(false)}
								className="text-blue-600 hover:text-blue-800"
							>
								×
							</button>
						</div>
					</div>
				)}

				{error && (
					<div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
						{error}
					</div>
				)}

				{success && (
					<div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
						{success}
					</div>
				)}

				{/* Budget Summary */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">Budget Summary</h2>
					<div className="grid grid-cols-3 gap-4">
						<div>
							<p className="text-sm text-gray-600">Total Income</p>
							<p className="text-2xl font-bold text-blue-600">
								{(totalIncome / 1000000).toFixed(1)} mnkr
							</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Total Expenses</p>
							<p className="text-2xl font-bold text-green-600">
								{(totalExpenses / 1000000).toFixed(1)} mnkr
							</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Balance</p>
							<p
								className={`text-2xl font-bold ${
									isBalanced
										? "text-emerald-600"
										: balance > 0
										? "text-blue-600"
										: "text-red-600"
								}`}
							>
								{balance >= 0 ? "+" : ""}
								{(balance / 1000000).toFixed(1)} mnkr
							</p>
						</div>
					</div>
					{!isBalanced && (
						<p className="text-sm text-yellow-600 mt-4">
							{balance > 0
								? "You have a surplus. Consider lowering income or increasing expenses."
								: "You have a deficit. Consider increasing income or reducing expenses."}
						</p>
					)}
				</div>

				{/* Expense Treemap Visualization */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">
						Expenses (Utgifter)
					</h2>
					<SimpleTreemap categories={budgetSession?.categories || []} />
				</div>

				{/* Income Treemap Visualization */}
				{budgetSession?.incomeCategories && budgetSession.incomeCategories.length > 0 && (
					<div className="bg-white rounded-xl shadow-sm p-6">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							Income (Intäkter)
						</h2>
						<SimpleTreemap categories={budgetSession.incomeCategories} />
					</div>
				)}

				{/* Expense Categories */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">
						Expense Categories
					</h2>
					<div className="space-y-3">
						{budgetSession?.categories.map((category) => (
							<CategoryInput
								key={category.id}
								category={category}
								allocation={allocations.find((a) => a.categoryId === category.id)}
								onUpdate={updateAllocation}
							/>
						))}
					</div>
				</div>

				{/* Income Categories */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">
						Income Sources
					</h2>
					<div className="space-y-3">
						{budgetSession?.incomeCategories.map((category) => {
							// Tax rate info for 2025: 19 kr = 2135.3 mnkr
							// This means tax base = 2135.3 mnkr / 19 kr = 112.4 million kr
							const taxRateInfo = budgetSession.taxBase
								? {
										taxBase: budgetSession.taxBase,
										defaultTaxRateKr: budgetSession.defaultTaxRateKr || 19,
										minTaxRateKr: budgetSession.minTaxRateKr || 18,
										maxTaxRateKr: budgetSession.maxTaxRateKr || 21,
								  }
								: null;

							return (
								<IncomeCategoryInput
									key={category.id}
									category={category}
									allocation={incomeAllocations.find(
										(a) => a.categoryId === category.id
									)}
									onUpdate={updateIncomeAllocation}
									taxRateInfo={taxRateInfo}
								/>
							);
						})}
					</div>
				</div>

				{/* Save Button */}
				<div className="flex justify-end">
					<button
						onClick={handleSaveVote}
						disabled={saving}
						className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
					>
						<Save className="w-5 h-5" />
						{saving ? "Saving..." : "Save Budget Proposal"}
					</button>
				</div>
			</main>
		</div>
	);
}
