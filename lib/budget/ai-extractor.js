/**
 * AI Budget Extractor
 * Uses Claude AI to extract budget data from PDF documents
 */

import Anthropic from "@anthropic-ai/sdk";
import pdf from "pdf-parse";
import fs from "fs";

/**
 * Extract text from PDF buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(pdfBuffer) {
	try {
		const data = await pdf(pdfBuffer);
		return data.text;
	} catch (error) {
		console.error("Error extracting PDF text:", error);
		throw new Error("Failed to extract text from PDF");
	}
}

/**
 * Extract budget data from PDF using Claude AI
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} documentType - "expenses" or "income"
 * @returns {Promise<Object>} - Extracted budget data
 */
export async function extractBudgetFromPDF(pdfBuffer, documentType = "expenses") {
	// Extract text from PDF
	const pdfText = await extractTextFromPDF(pdfBuffer);

	// Initialize Anthropic client
	const anthropic = new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY,
	});

	// Create appropriate prompt based on document type
	let prompt = "";

	if (documentType === "expenses") {
		prompt = `Extrahera budgetdata från denna kommunala driftsredovisning.

Analysera följande PDF-text och extrahera budgetinformation:

${pdfText}

Jag behöver följande information strukturerad som JSON:

1. Identifiera alla nämnder (committees) och deras nettokostnader
2. För varje nämnd, extrahera underverksamheter (subcategories) om tillgängligt
3. Identifiera vilka kostnader som är oundvikliga (unavoidable) såsom:
   - Pensionskostnader
   - Skolpeng
   - Gymnasieskolpeng
   - Andra lagstadgade utgifter

Returnera JSON i följande format:
{
  "categories": [
    {
      "name": "Kommunstyrelsen",
      "amount": 148800000,
      "minAmount": 50000000,
      "isFixed": false,
      "subcategories": [
        {
          "name": "Pensionskostnader",
          "amount": 50000000,
          "minAmount": 50000000,
          "isFixed": true
        }
      ]
    }
  ],
  "totalBudget": 1925600000
}

VIKTIGT:
- Alla belopp ska vara i kronor (inte mkr eller tkr)
- Om dokumentet visar belopp i mkr, multiplicera med 1,000,000
- minAmount ska vara den oundvikliga delen av kostnaden (uppskattat till cirka 30-50% för flexibla poster, 100% för fasta poster)
- isFixed ska vara true endast för helt oundvikliga kostnader`;

	} else if (documentType === "income") {
		prompt = `Extrahera intäktsdata från detta kommunala budgetdokument.

Analysera följande PDF-text och extrahera intäktsinformation:

${pdfText}

Jag behöver följande information strukturerad som JSON:

1. Identifiera alla intäktskällor (skatteintäkter, statsbidrag, etc.)
2. För skatteintäkter, försök identifiera kommunalskattesatsen
3. Extrahera belopp för varje intäktskategori

Returnera JSON i följande format:
{
  "incomeCategories": [
    {
      "name": "Skatteintäkter",
      "amount": 2024500000,
      "isTaxRate": true,
      "taxRatePercent": 21.56
    },
    {
      "name": "Generella statsbidrag",
      "amount": 293500000,
      "isTaxRate": false
    }
  ],
  "totalIncome": 2360300000
}

VIKTIGT:
- Alla belopp ska vara i kronor (inte mkr eller tkr)
- Om dokumentet visar belopp i mkr, multiplicera med 1,000,000
- isTaxRate ska vara true endast för kommunalskatt
- taxRatePercent ska vara skattesatsen i procent (t.ex. 21.56 för 21.56%)`;
	}

	try {
		const message = await anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 4096,
			messages: [
				{
					role: "user",
					content: prompt,
				},
			],
		});

		// Extract JSON from response
		const responseText = message.content[0].text;

		// Try to find JSON in the response
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("No JSON found in AI response");
		}

		const extractedData = JSON.parse(jsonMatch[0]);

		// Generate IDs for categories
		if (extractedData.categories) {
			extractedData.categories = extractedData.categories.map((cat, idx) => {
				const id = cat.name
					.toLowerCase()
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");

				const subcategories = (cat.subcategories || []).map((sub, subIdx) => {
					const subId = sub.name
						.toLowerCase()
						.replace(/å/g, "a")
						.replace(/ä/g, "a")
						.replace(/ö/g, "o")
						.replace(/\s+/g, "-")
						.replace(/[^a-z0-9-]/g, "");

					return {
						...sub,
						id: `${id}-${subId}-${subIdx}`,
					};
				});

				return {
					...cat,
					id: `${id}-${idx}`,
					defaultAmount: cat.amount,
					subcategories,
				};
			});
		}

		if (extractedData.incomeCategories) {
			extractedData.incomeCategories = extractedData.incomeCategories.map((cat, idx) => {
				const id = cat.name
					.toLowerCase()
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");

				return {
					...cat,
					id: `${id}-${idx}`,
				};
			});
		}

		return extractedData;
	} catch (error) {
		console.error("Error calling Claude AI:", error);
		throw new Error("Failed to extract budget data using AI");
	}
}

/**
 * Generate default colors for categories
 * @param {number} index - Category index
 * @param {number} total - Total number of categories
 * @param {string} type - "expense" or "income"
 * @returns {string} - Hex color code
 */
export function generateCategoryColor(index, total, type = "expense") {
	if (type === "income") {
		// Gray-blue colors for income
		const colors = [
			"#6b7280", // gray-500
			"#4b5563", // gray-600
			"#9ca3af", // gray-400
			"#374151", // gray-700
			"#60a5fa", // blue-400
		];
		return colors[index % colors.length];
	} else {
		// Green-yellow-red gradient for expenses
		// Hue: 120 (green) -> 60 (yellow) -> 0 (red)
		const hue = 120 - (index / Math.max(total - 1, 1)) * 120;
		const saturation = 70;
		const lightness = 50;
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}
}
