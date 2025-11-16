/**
 * AI Budget Extractor
 * Uses Claude AI to extract budget data from PDF documents
 * Claude can read PDFs directly, so we don't need pdf-parse!
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Extract budget data from PDF using Claude AI (direct PDF reading)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} documentType - "expenses" or "income"
 * @returns {Promise<Object>} - Extracted budget data
 */
export async function extractBudgetFromPDF(pdfBuffer, documentType = "expenses") {
	// Initialize Anthropic client
	const anthropic = new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY,
	});

	// Convert buffer to base64 for Claude API
	const pdfBase64 = pdfBuffer.toString("base64");

	// Create appropriate prompt based on document type
	let prompt = "";

	if (documentType === "expenses") {
		prompt = `Du är en expert på svenska kommunala budgetar. Analysera denna PDF-fil (driftsredovisning) och extrahera ALLA nämnder med deras kostnader.

VIKTIGA INSTRUKTIONER:
1. Hitta ALLA nämnder i dokumentet (ofta 8-12 stycken)
2. Använd NETTOKOSTNAD-kolumnen (oftast tredje sifferkolumnen)
3. Leta efter dessa vanliga nämnder:
   - Kommunstyrelsen
   - Barn- och ungdomsnämnden
   - Skolpeng
   - Utbildningsnämnden
   - Gymnasieskolpeng
   - Socialnämnden
   - Fritidsnämnden
   - Kulturnämnden
   - Bygg- och miljötillsynsnämnden
   - Räddningstjänsten (om finns)

4. Identifiera oundvikliga kostnader:
   - Pensionskostnader = 100% oundviklig (isFixed: true)
   - Skolpeng = 100% oundviklig (isFixed: true)
   - Gymnasieskolpeng = 100% oundviklig (isFixed: true)
   - LSS/sociala avgifter = 100% oundviklig (isFixed: true)
   - Övriga nämnder: minAmount = 40% av totalbelopp, isFixed: false

RETURNERA ENDAST JSON (ingen annan text):
{
  "categories": [
    {
      "name": "Kommunstyrelsen",
      "amount": 148800000,
      "minAmount": 59520000,
      "isFixed": false,
      "subcategories": []
    },
    {
      "name": "Skolpeng",
      "amount": 678500000,
      "minAmount": 678500000,
      "isFixed": true,
      "subcategories": []
    }
  ],
  "totalBudget": 1925600000
}

KONVERTERING:
- Om belopp visas i "mnkr" eller "mkr" → multiplicera med 1000000
- Om belopp visas i "tkr" → multiplicera med 1000
- Exempel: "148,8 mnkr" = 148800000 kr
- Negativa belopp (kostnader) = gör positiva

VALIDERING:
- categories ska innehålla MINST 8 nämnder
- totalBudget = summan av alla amounts
- Alla belopp i heltal (kronor)`;


	} else if (documentType === "income") {
		prompt = `Du är en expert på svenska kommunala budgetar. Analysera denna PDF-fil (intäkter & bidrag) och extrahera ALLA intäktskällor.

VIKTIGA INSTRUKTIONER:
1. Hitta ALLA intäktskällor (vanligtvis 3-6 poster)
2. Vanliga intäktskällor:
   - Skatteintäkter (största posten)
   - Generella statsbidrag
   - Finansiella intäkter
   - Avgifter och ersättningar
   - Hyror och arrenden

3. Hitta kommunalskattesats (procent) om den finns i dokumentet
   - Ofta står det "kommunalskatt" eller "skattesats"
   - Vanligt intervall: 20-23%

RETURNERA ENDAST JSON (ingen annan text):
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
    },
    {
      "name": "Finansiella intäkter",
      "amount": 42300000,
      "isTaxRate": false
    }
  ],
  "totalIncome": 2360300000
}

KONVERTERING:
- Om belopp visas i "mnkr" eller "mkr" → multiplicera med 1000000
- Om belopp visas i "tkr" → multiplicera med 1000
- Exempel: "2 024,5 mnkr" = 2024500000 kr

VALIDERING:
- incomeCategories ska innehålla MINST 3 poster
- totalIncome = summan av alla amounts
- isTaxRate = true ENDAST för "Skatteintäkter"
- Alla belopp i heltal (kronor)`;
	}

	try {
		const message = await anthropic.messages.create({
			model: "claude-haiku-4-5",
			max_tokens: 4096,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "document",
							source: {
								type: "base64",
								media_type: "application/pdf",
								data: pdfBase64,
							},
						},
						{
							type: "text",
							text: prompt,
						},
					],
				},
			],
		});

		// Extract JSON from response
		const responseText = message.content[0].text;

		console.log("Claude response:", responseText.substring(0, 500)); // Debug log

		// Try to find JSON in the response (supports both ```json and plain JSON)
		let jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
		if (!jsonMatch) {
			jsonMatch = responseText.match(/\{[\s\S]*\}/);
		}

		if (!jsonMatch) {
			console.error("Full response:", responseText);
			throw new Error("No JSON found in AI response. Check the logs.");
		}

		const jsonString = jsonMatch[1] || jsonMatch[0];
		const extractedData = JSON.parse(jsonString);

		// Validate the extracted data
		if (documentType === "expenses") {
			if (!extractedData.categories || extractedData.categories.length < 3) {
				throw new Error(`Too few categories extracted: ${extractedData.categories?.length || 0}. Expected at least 8 committees.`);
			}
		} else if (documentType === "income") {
			if (!extractedData.incomeCategories || extractedData.incomeCategories.length < 2) {
				throw new Error(`Too few income categories extracted: ${extractedData.incomeCategories?.length || 0}. Expected at least 3.`);
			}
		}

		// Generate IDs and ensure proper structure for categories
		if (extractedData.categories) {
			const totalCategories = extractedData.categories.length;
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
						defaultAmount: sub.amount || 0,
						minAmount: sub.minAmount || 0,
						isFixed: sub.isFixed || false,
					};
				});

				return {
					...cat,
					id: `${id}-${idx}`,
					defaultAmount: cat.amount,
					minAmount: cat.minAmount || Math.floor(cat.amount * 0.4),
					isFixed: cat.isFixed || false,
					color: generateCategoryColor(idx, totalCategories, "expense"),
					subcategories,
				};
			});
		}

		if (extractedData.incomeCategories) {
			const totalIncome = extractedData.incomeCategories.length;
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
					isTaxRate: cat.isTaxRate || false,
					taxRatePercent: cat.taxRatePercent || null,
					color: generateCategoryColor(idx, totalIncome, "income"),
				};
			});
		}

		console.log("Extracted data summary:", {
			categories: extractedData.categories?.length,
			incomeCategories: extractedData.incomeCategories?.length,
			totalBudget: extractedData.totalBudget,
			totalIncome: extractedData.totalIncome,
		});

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
