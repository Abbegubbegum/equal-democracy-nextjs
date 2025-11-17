import { useState, useEffect } from "react";

/**
 * Income Category Input Component
 * Handles income sources with special treatment for tax rate (skatteintäkter)
 */
export default function IncomeCategoryInput({ category, allocation, onUpdate, taxRateInfo, readOnly = false }) {
	const isTaxIncome = category.isTaxRate || category.name.toLowerCase().includes("skatt");

	// For tax income, we work with tax rate (kr per invånare)
	// For other income, we work with direct amounts
	const minValue = isTaxIncome && taxRateInfo
		? taxRateInfo.minTaxRateKr || 18
		: (category.minAmount || category.amount * 0.7);

	const defaultValue = isTaxIncome && taxRateInfo
		? taxRateInfo.defaultTaxRateKr || 19
		: (category.defaultAmount || category.amount);

	// Calculate maximum so that default is in the middle
	// For tax rate: maxValue = minValue + 2 * (defaultValue - minValue)
	// For regular income: same formula
	const maxValue = minValue + 2 * (defaultValue - minValue);

	// Mode switching for tax income: "rate" (kr) or "amount" (mnkr)
	const [viewMode, setViewMode] = useState("rate"); // "rate" or "amount"
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");

	// Current value in the appropriate unit (kr for tax, full amount for others)
	const [value, setValue] = useState(
		isTaxIncome && allocation?.taxRateKr
			? allocation.taxRateKr
			: allocation?.amount || defaultValue
	);

	// Sync with allocation prop changes - use effect only to update when external value changes
	const taxRateKr = allocation?.taxRateKr;
	const allocationAmount = allocation?.amount;
	useEffect(() => {
		const newValue = isTaxIncome && taxRateKr !== undefined ? taxRateKr : allocationAmount;
		if (newValue !== undefined && newValue !== value) {
			setValue(newValue);
		}
	}, [isTaxIncome, taxRateKr, allocationAmount, value]);

	function handleSliderChange(e) {
		const newValue = parseFloat(e.target.value);
		setValue(newValue);

		if (isTaxIncome && taxRateInfo) {
			// Convert tax rate (kr) to total amount
			const totalAmount = newValue * taxRateInfo.taxBase;
			onUpdate(category.id, totalAmount, newValue);
		} else {
			onUpdate(category.id, newValue);
		}
	}

	function handleEditClick() {
		setIsEditing(true);
		if (isTaxIncome && taxRateInfo) {
			if (viewMode === "rate") {
				setEditValue(value.toFixed(2));
			} else {
				// Amount mode - show in mnkr
				setEditValue((value * taxRateInfo.taxBase / 1000000).toFixed(1));
			}
		} else {
			setEditValue((value / 1000000).toFixed(1));
		}
	}

	function handleEditChange(e) {
		setEditValue(e.target.value);
	}

	function handleEditBlur() {
		const newNum = parseFloat(editValue);
		if (!isNaN(newNum)) {
			if (isTaxIncome && taxRateInfo) {
				if (viewMode === "rate") {
					// Editing tax rate in kr
					if (newNum >= minValue && newNum <= maxValue) {
						setValue(newNum);
						const totalAmount = newNum * taxRateInfo.taxBase;
						onUpdate(category.id, totalAmount, newNum);
					}
				} else {
					// Editing amount in mnkr - convert back to tax rate
					const newAmount = newNum * 1000000;
					const newTaxRate = newAmount / taxRateInfo.taxBase;
					if (newTaxRate >= minValue && newTaxRate <= maxValue) {
						setValue(newTaxRate);
						onUpdate(category.id, newAmount, newTaxRate);
					}
				}
			} else {
				// Non-tax income
				const newAmount = newNum * 1000000;
				if (newAmount >= minValue && newAmount <= maxValue) {
					setValue(newAmount);
					onUpdate(category.id, newAmount);
				}
			}
		}
		setIsEditing(false);
	}

	function handleEditKeyDown(e) {
		if (e.key === "Enter") {
			handleEditBlur();
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
	}

	function toggleViewMode() {
		setViewMode(viewMode === "rate" ? "amount" : "rate");
	}

	// Display values based on view mode
	let displayValue, displayUnit, minDisplay, maxDisplay, defaultDisplay;

	if (isTaxIncome && taxRateInfo) {
		if (viewMode === "rate") {
			// Show tax rate in kr
			displayValue = value.toFixed(2);
			displayUnit = "kr";
			minDisplay = minValue.toFixed(2) + " kr";
			maxDisplay = maxValue.toFixed(2) + " kr";
			defaultDisplay = defaultValue.toFixed(2) + " kr";
		} else {
			// Show amount in mnkr
			displayValue = (value * taxRateInfo.taxBase / 1000000).toFixed(1);
			displayUnit = "mnkr";
			minDisplay = (minValue * taxRateInfo.taxBase / 1000000).toFixed(1) + " mnkr";
			maxDisplay = (maxValue * taxRateInfo.taxBase / 1000000).toFixed(1) + " mnkr";
			defaultDisplay = (defaultValue * taxRateInfo.taxBase / 1000000).toFixed(1) + " mnkr";
		}
	} else {
		// Show amount in mnkr for non-tax income
		displayValue = (value / 1000000).toFixed(1);
		displayUnit = "mnkr";
		minDisplay = (minValue / 1000000).toFixed(1) + " mnkr";
		maxDisplay = (maxValue / 1000000).toFixed(1) + " mnkr";
		defaultDisplay = (defaultValue / 1000000).toFixed(1) + " mnkr";
	}

	// Calculate percentage for visual indicators
	const defaultPercentage = ((defaultValue - minValue) / (maxValue - minValue)) * 100;
	const currentPercentage = ((value - minValue) / (maxValue - minValue)) * 100;

	return (
		<div className="p-4 bg-white border border-blue-200 rounded-lg">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<h3 className="font-medium text-gray-900">{category.name}</h3>
					{isTaxIncome && taxRateInfo && (
						<button
							onClick={toggleViewMode}
							className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded-full transition-colors cursor-pointer"
							title="Click to switch between tax rate and amount"
						>
							{viewMode === "rate" ? "Tax Rate (kr)" : "Amount (mnkr)"}
						</button>
					)}
				</div>
				<div className="text-right">
					{isEditing ? (
						<div className="flex items-center gap-1">
							<input
								type="number"
								step={viewMode === "rate" ? "0.01" : "0.1"}
								value={editValue}
								onChange={handleEditChange}
								onBlur={handleEditBlur}
								onKeyDown={handleEditKeyDown}
								className="w-24 px-2 py-1 text-lg font-bold text-blue-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								autoFocus
							/>
							<span className="text-sm text-blue-600">{displayUnit}</span>
						</div>
					) : (
						<div
							className="flex items-center gap-1 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
							onClick={handleEditClick}
							title="Click to edit"
						>
							<span className="text-lg font-bold text-blue-900">{displayValue}</span>
							<span className="text-sm text-blue-600">{displayUnit}</span>
						</div>
					)}
				</div>
			</div>

			<>
				<div className="relative mb-2">
					{/* Slider track - minimum on LEFT, maximum on RIGHT */}
					<div className="relative h-2 bg-blue-100 rounded-full">
						{/* Default position marker (darker blue line) */}
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10"
							style={{ left: `${defaultPercentage}%` }}
						/>
						{/* Filled track from left (minimum) to current position */}
						<div
							className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
							style={{
								width: `${currentPercentage}%`
							}}
						/>
					</div>

					{/* Slider input */}
					<input
						type="range"
						min={minValue}
						max={maxValue}
						step={isTaxIncome ? 0.01 : Math.max(1000000, Math.floor((maxValue - minValue) / 100))}
						value={value}
						onChange={handleSliderChange}
						disabled={readOnly}
						className="absolute top-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
						style={{ zIndex: 20 }}
					/>
				</div>

				{/* Labels */}
				<div className="flex justify-between text-xs text-gray-600 mb-1">
					<span className="font-medium">
						Min: {minDisplay}
					</span>
					<span className="text-blue-600 font-medium">
						Default: {defaultDisplay}
					</span>
					<span className="font-medium">
						Max: {maxDisplay}
					</span>
				</div>

				{isTaxIncome && taxRateInfo && (
					<div className="text-xs text-blue-600 mt-2 italic">
						{viewMode === "rate"
							? `Tax base: ${(taxRateInfo.taxBase / 1000000).toFixed(1)} mnkr (population × 1000 kr)`
							: `Current tax rate: ${value.toFixed(2)} kr per resident`
						}
					</div>
				)}
			</>
		</div>
	);
}
