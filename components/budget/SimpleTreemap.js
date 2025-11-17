import { useEffect, useRef } from "react";
import * as d3 from "d3";

/**
 * Simple Mobile-Friendly Treemap for Budget Committees
 * Shows only expense categories with green-to-red color scale
 * Displays committee name and amount in mnkr
 */
export default function SimpleTreemap({ categories }) {
	const containerRef = useRef(null);

	useEffect(() => {
		if (!containerRef.current || !categories || categories.length === 0) return;

		// Clear previous content
		d3.select(containerRef.current).selectAll("*").remove();

		// Get container dimensions (mobile-responsive)
		const container = containerRef.current;
		const width = container.clientWidth;
		const height = Math.min(width * 0.75, 600); // 4:3 aspect ratio, max 600px height

		// Create SVG
		const svg = d3
			.select(container)
			.append("svg")
			.attr("width", width)
			.attr("height", height)
			.attr("viewBox", `0 0 ${width} ${height}`)
			.style("font-family", "sans-serif");

		// Prepare data for treemap
		const data = {
			name: "Budget",
			children: categories.map((cat) => ({
				name: cat.name,
				value: cat.amount || cat.defaultAmount,
				color: cat.color,
				id: cat.id,
			})),
		};

		// Create hierarchy
		const root = d3
			.hierarchy(data)
			.sum((d) => d.value)
			.sort((a, b) => b.value - a.value);

		// Create treemap layout
		const treemap = d3
			.treemap()
			.size([width, height])
			.padding(2)
			.round(true);

		treemap(root);

		// Draw rectangles
		const cells = svg
			.selectAll("g")
			.data(root.leaves())
			.join("g")
			.attr("transform", (d) => `translate(${d.x0},${d.y0})`);

		// Add colored rectangles
		cells
			.append("rect")
			.attr("width", (d) => d.x1 - d.x0)
			.attr("height", (d) => d.y1 - d.y0)
			.attr("fill", (d) => d.data.color)
			.attr("stroke", "#fff")
			.attr("stroke-width", 2);

		// Add text labels
		cells.each(function (d) {
			const cell = d3.select(this);
			const rectWidth = d.x1 - d.x0;
			const rectHeight = d.y1 - d.y0;
			const centerX = rectWidth / 2;
			const centerY = rectHeight / 2;

			// Committee name (wrapped if needed)
			const nameLines = wrapText(d.data.name, rectWidth - 10);
			const fontSize = Math.min(rectWidth / 10, rectHeight / 10, 16);

			nameLines.forEach((line, i) => {
				cell
					.append("text")
					.attr("x", centerX)
					.attr("y", centerY - nameLines.length * fontSize / 2 + i * fontSize + fontSize / 2)
					.attr("text-anchor", "middle")
					.attr("dominant-baseline", "middle")
					.attr("fill", "#1e293b")
					.attr("font-size", `${fontSize}px`)
					.attr("font-weight", "bold")
					.text(line);
			});

			// Amount in mnkr
			const amountText = `${(d.value / 1000000).toFixed(1)} mnkr`;
			const amountFontSize = Math.min(rectWidth / 12, rectHeight / 12, 14);

			cell
				.append("text")
				.attr("x", centerX)
				.attr("y", centerY + nameLines.length * fontSize / 2 + amountFontSize)
				.attr("text-anchor", "middle")
				.attr("dominant-baseline", "middle")
				.attr("fill", "#475569")
				.attr("font-size", `${amountFontSize}px`)
				.text(amountText);
		});

		// Responsive resize handler
		const handleResize = () => {
			if (!containerRef.current) return;
			const newWidth = container.clientWidth;
			const newHeight = Math.min(newWidth * 0.75, 600);

			svg.attr("width", newWidth).attr("height", newHeight);
			svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);

			// Recalculate treemap with new dimensions
			treemap.size([newWidth, newHeight]);
			treemap(root);

			// Update positions and sizes
			cells.attr("transform", (d) => `translate(${d.x0},${d.y0})`);

			cells.select("rect")
				.attr("width", (d) => d.x1 - d.x0)
				.attr("height", (d) => d.y1 - d.y0);

			// Update text positions
			cells.each(function (d) {
				const cell = d3.select(this);
				const rectWidth = d.x1 - d.x0;
				const rectHeight = d.y1 - d.y0;
				const centerX = rectWidth / 2;
				const centerY = rectHeight / 2;

				cell.selectAll("text").remove();

				const nameLines = wrapText(d.data.name, rectWidth - 10);
				const fontSize = Math.min(rectWidth / 10, rectHeight / 10, 16);

				nameLines.forEach((line, i) => {
					cell
						.append("text")
						.attr("x", centerX)
						.attr("y", centerY - nameLines.length * fontSize / 2 + i * fontSize + fontSize / 2)
						.attr("text-anchor", "middle")
						.attr("dominant-baseline", "middle")
						.attr("fill", "#1e293b")
						.attr("font-size", `${fontSize}px`)
						.attr("font-weight", "bold")
						.text(line);
				});

				const amountText = `${(d.value / 1000000).toFixed(1)} mnkr`;
				const amountFontSize = Math.min(rectWidth / 12, rectHeight / 12, 14);

				cell
					.append("text")
					.attr("x", centerX)
					.attr("y", centerY + nameLines.length * fontSize / 2 + amountFontSize)
					.attr("text-anchor", "middle")
					.attr("dominant-baseline", "middle")
					.attr("fill", "#475569")
					.attr("font-size", `${amountFontSize}px`)
					.text(amountText);
			});
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [categories]);

	// Helper function to wrap text
	function wrapText(text, maxWidth) {
		const words = text.split(/\s+/);
		const lines = [];
		let currentLine = words[0];

		for (let i = 1; i < words.length; i++) {
			const testLine = currentLine + " " + words[i];
			// Rough estimate: 8px per character
			if (testLine.length * 8 < maxWidth) {
				currentLine = testLine;
			} else {
				lines.push(currentLine);
				currentLine = words[i];
			}
		}
		lines.push(currentLine);
		return lines.slice(0, 3); // Max 3 lines
	}

	return (
		<div className="w-full">
			<div
				ref={containerRef}
				className="w-full bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
			/>
		</div>
	);
}
