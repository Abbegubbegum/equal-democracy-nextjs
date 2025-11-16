import { useState } from "react";

/**
 * Category Input Component
 * Allows users to input budget amounts with validation
 */
export default function CategoryInput({ category, allocation, onUpdate, readOnly = false }) {
	const [value, setValue] = useState(
		allocation?.amount ? (allocation.amount / 1000000).toFixed(1) : "0"
	);
	const [error, setError] = useState("");

	function handleChange(e) {
		const newValue = e.target.value;
		setValue(newValue);

		const amount = parseFloat(newValue) * 1000000;

		// Validate against minimum
		if (amount < category.minAmount) {
			setError(`Minimum: ${(category.minAmount / 1000000).toFixed(1)} mnkr`);
		} else {
			setError("");
			onUpdate(category.id, amount);
		}
	}

	const isFixed = category.isFixed;
	const isAtMinimum = allocation?.amount <= category.minAmount;

	return (
		<div className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg">
			<div className="flex-1">
				<div className="flex items-center gap-2">
					<h3 className="font-medium text-gray-900">{category.name}</h3>
					{isFixed && (
						<span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
							Fixed
						</span>
					)}
					{!isFixed && isAtMinimum && (
						<span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
							At minimum
						</span>
					)}
				</div>
				{category.minAmount > 0 && !isFixed && (
					<p className="text-xs text-gray-500 mt-1">
						Minimum: {(category.minAmount / 1000000).toFixed(1)} mnkr
					</p>
				)}
			</div>

			<div className="flex items-center gap-2">
				<input
					type="number"
					step="0.1"
					min={(category.minAmount / 1000000).toFixed(1)}
					value={value}
					onChange={handleChange}
					disabled={readOnly || isFixed}
					className={`w-32 p-2 border rounded-lg text-right ${
						error ? "border-red-500" : "border-gray-300"
					} ${readOnly || isFixed ? "bg-gray-100 cursor-not-allowed" : ""}`}
				/>
				<span className="text-sm text-gray-600 w-12">mnkr</span>
			</div>

			{error && <p className="text-xs text-red-600">{error}</p>}
		</div>
	);
}
