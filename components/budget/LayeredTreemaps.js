import { useState, useRef, useEffect } from "react";
import SimpleTreemap from "./SimpleTreemap";

/**
 * Layered Treemaps Component
 * Two treemaps positioned like overlapping cards with offset
 * - Both are always visible, one behind the other
 * - They're offset both horizontally and vertically
 * - Click on the visible part of the back card to bring it to front
 * - Swipe to switch between cards
 * - Click on parenthesis text in header to toggle
 * - The offset remains the same, only Z-position changes
 */
export default function LayeredTreemaps({ expenseCategories, incomeCategories, showingIncome: externalShowingIncome, onToggle }) {
	const [internalShowingIncome, setInternalShowingIncome] = useState(false);
	const containerRef = useRef(null);
	const touchStartX = useRef(0);
	const touchStartY = useRef(0);

	// Use external state if provided, otherwise use internal state
	const showingIncome = externalShowingIncome !== undefined ? externalShowingIncome : internalShowingIncome;

	const toggleView = () => {
		if (onToggle) {
			onToggle(!showingIncome);
		} else {
			setInternalShowingIncome(!showingIncome);
		}
	};

	// Offset amounts (in pixels)
	const horizontalOffset = 16; // Horizontal shift
	const verticalOffset = 8; // Vertical shift

	// Touch handlers for swipe gesture
	const handleTouchStart = (e) => {
		touchStartX.current = e.touches[0].clientX;
		touchStartY.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e) => {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;

		const deltaX = touchEndX - touchStartX.current;
		const deltaY = touchEndY - touchStartY.current;

		// Only trigger swipe if horizontal movement is greater than vertical
		// Any horizontal swipe toggles between the two views
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
			toggleView();
		}
	};

	return (
		<div className="bg-white rounded-xl shadow-sm overflow-hidden">
			{/* Dynamic header with clickable parenthesis text */}
			<div className="p-6 pb-4">
				<h2 className="text-lg font-bold text-gray-900">
					{showingIncome ? "Intäkter" : "Utgifter"}{" "}
					<span
						onClick={toggleView}
						className="text-gray-600 font-normal cursor-pointer hover:text-emerald-600 transition-colors"
						title={`Klicka för att visa ${showingIncome ? "utgifter" : "intäkter"}`}
					>
						({showingIncome ? "utgifter" : "intäkter"} bakom)
					</span>
				</h2>
			</div>

			{/* Container for overlapping treemaps with swipe support */}
			<div
				ref={containerRef}
				className="relative p-6 touch-pan-y"
				style={{ aspectRatio: '16 / 9' }}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{/* Expenses Treemap (green) */}
				<div
					onClick={showingIncome ? toggleView : undefined}
					className={`absolute bg-white rounded-xl overflow-hidden transition-all duration-300 ${
						showingIncome ? "cursor-pointer shadow-md" : "shadow-lg"
					}`}
					style={{
						// When Income is in front: Expenses positioned to the left and slightly up
						// When Expenses is in front: Expenses centered
						left: showingIncome ? 0 : `${horizontalOffset}px`,
						top: showingIncome ? 0 : `${verticalOffset}px`,
						right: showingIncome ? `${horizontalOffset * 2}px` : `${horizontalOffset}px`,
						bottom: showingIncome ? `${verticalOffset * 2}px` : `${verticalOffset}px`,
						zIndex: showingIncome ? 1 : 10,
					}}
				>
					<SimpleTreemap categories={expenseCategories || []} />
				</div>

				{/* Income Treemap (blue) */}
				<div
					onClick={!showingIncome ? toggleView : undefined}
					className={`absolute bg-white rounded-xl overflow-hidden transition-all duration-300 ${
						!showingIncome ? "cursor-pointer shadow-md" : "shadow-lg"
					}`}
					style={{
						// When Expenses is in front: Income positioned to the right and slightly down
						// When Income is in front: Income centered
						left: showingIncome ? `${horizontalOffset}px` : `${horizontalOffset * 2}px`,
						top: showingIncome ? `${verticalOffset}px` : `${verticalOffset * 2}px`,
						right: showingIncome ? `${horizontalOffset}px` : 0,
						bottom: showingIncome ? `${verticalOffset}px` : 0,
						zIndex: showingIncome ? 10 : 1,
					}}
				>
					<SimpleTreemap categories={incomeCategories || []} />
				</div>
			</div>
		</div>
	);
}
