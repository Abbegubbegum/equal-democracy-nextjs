# Equal Democracy - Budget Module

## Overview

The Budget module implements **Median Budget Voting**, a democratic process where participants submit individual budget proposals and the collective decision is determined by calculating the median values across all submissions.

## Features

- **AI-Powered PDF Extraction**: Upload municipal budget PDFs and automatically extract categories, amounts, and unavoidable expenses using Claude AI
- **Interactive Treemap Visualization**: Two-layer visual representation showing income (background) and expenses (foreground)
- **Dual Interaction Mode**: Users can adjust budgets by dragging on the treemap OR entering numeric values
- **Median Calculation**: Automatically calculates the collective median budget from all individual proposals
- **Balance Algorithm**: Ensures expenses match income by converting to percentages and scaling
- **Unavoidable Expense Protection**: Prevents users from reducing fixed or minimum required expenses

## Setup

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Anthropic API Key for AI extraction
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get your API key from: https://console.anthropic.com/

### 2. Database Models

The following MongoDB models have been added to `lib/models.js`:

- **BudgetSession**: Voting sessions with categories, income sources, and metadata
- **BudgetVote**: Individual participant budget proposals
- **BudgetResult**: Calculated median results after voting closes

### 3. Dependencies

The following packages were installed:

```bash
npm install @anthropic-ai/sdk formidable d3
```

**Note**: We use Claude's native PDF reading capability, so pdf-parse is not required!

## File Structure

```
pages/
├── budget/
│   ├── admin/
│   │   └── index.js              # Budget admin panel (superadmin only)
│   ├── [sessionId].js            # Voting interface
│   └── results/
│       └── [sessionId].js        # Results visualization
├── api/
│   └── budget/
│       ├── sessions.js           # CRUD for budget sessions
│       ├── upload-pdf.js         # PDF upload & AI extraction
│       ├── vote.js               # Submit/update votes
│       └── results.js            # Calculate/view results

components/
└── budget/
    ├── TreemapViz.js             # Interactive treemap visualization
    └── CategoryInput.js          # Numeric input for categories

lib/
└── budget/
    ├── ai-extractor.js           # AI PDF extraction logic
    └── median-calculator.js      # Median calculation & validation
```

## How It Works

### 1. Admin Workflow

1. **Upload PDFs**: Superadmin uploads expense and income PDFs
2. **AI Extraction**: Claude AI extracts budget data (categories, amounts, minimums)
3. **Create Session**: Superadmin creates a new budget session with extracted data
4. **Activate Session**: Change status from "draft" to "active" to allow voting
5. **Close Voting**: When ready, close the session to trigger median calculation
6. **View Results**: See the collective median budget

### 2. Participant Workflow

1. **Access Session**: Navigate to `/budget/[sessionId]`
2. **Adjust Budget**:
   - Use treemap visualization (drag to resize)
   - Use numeric inputs (type amounts in mkr)
   - Cannot reduce below unavoidable minimums
3. **Balance Budget**: Ensure total expenses match total income
4. **Submit Proposal**: Save individual budget proposal
5. **Wait for Results**: After voting closes, median is calculated

### 3. Median Calculation Algorithm

1. **Calculate Income Medians**: Find median for each income category across all votes
2. **Calculate Expense Medians**: Find median for each expense category across all votes
3. **Convert to Percentages**: Express each expense as percentage of total
4. **Balance to Income**: Scale all expense percentages so total equals median income
5. **Store Results**: Save balanced median budget

## Example Usage

### Creating a Session via API

```javascript
const response = await fetch('/api/budget/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Vallentuna Budget 2025',
    municipality: 'Vallentuna',
    totalBudget: 2100000000, // 2.1 billion kr
    categories: [
      {
        id: 'kommunstyrelsen-0',
        name: 'Kommunstyrelsen',
        defaultAmount: 148800000,
        minAmount: 50000000,
        isFixed: false,
        color: '#4a90e2',
        subcategories: []
      }
      // ... more categories
    ],
    incomeCategories: [
      {
        id: 'skatteintakter-0',
        name: 'Skatteintäkter',
        amount: 2024500000,
        isTaxRate: true,
        taxRatePercent: 21.56,
        color: '#6b7280'
      }
      // ... more income sources
    ]
  })
});
```

### Submitting a Vote

```javascript
const response = await fetch('/api/budget/vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session_id_here',
    allocations: [
      {
        categoryId: 'kommunstyrelsen-0',
        amount: 120000000,
        subcategories: []
      }
      // ... more allocations
    ],
    incomeAllocations: [
      {
        categoryId: 'skatteintakter-0',
        amount: 2000000000,
        taxRatePercent: 21.0
      }
      // ... more income allocations
    ],
    totalExpenses: 1925000000,
    totalIncome: 2000000000
  })
});
```

## Key Concepts

### Unavoidable Expenses

- **Fixed**: Cannot be changed at all (100% required)
- **Minimum**: Can be increased but not reduced below minimum
- **Visual Indicator**: Pattern overlay on treemap

### Median Voting

Why median instead of average?
- **Resistant to extremes**: One very high/low proposal doesn't skew results
- **Represents middle ground**: 50% wanted more, 50% wanted less
- **Democratic fairness**: Everyone's preference equally weighted

### Balance Algorithm

After calculating medians, expenses might not equal income. The balance algorithm:
1. Converts each expense to percentage of total expenses
2. Scales all percentages so total equals median income
3. Maintains relative proportions between categories

## Access Control

- **Budget Admin Panel**: Superadmin only
- **Voting Interface**: Any logged-in user
- **Results**: Any logged-in user (after session closes)

## Future Enhancements

Potential features to add:
- [ ] Drill-down to subcategories (Level 2 view)
- [ ] QR code attendance tracking for information meetings
- [ ] Group discussion features before voting
- [ ] Historical comparison (compare to previous years)
- [ ] Export to CSV/Excel
- [ ] Multi-language support for budget data
- [ ] Real-time collaboration during proposal creation
- [ ] Visualization of all individual proposals (anonymized)

## Troubleshooting

### PDF Extraction Not Working

1. Check that `ANTHROPIC_API_KEY` is set in `.env.local`
2. Ensure PDF is in Swedish (or update prompts in `ai-extractor.js`)
3. Check PDF file size is under 10MB (upload limit)
4. Review Claude API console for errors
5. Claude reads PDFs natively - no additional dependencies needed!

### Treemap Not Rendering

1. Check browser console for D3.js errors
2. Ensure canvas element has proper dimensions
3. Verify data structure matches expected format
4. Check that all amounts are positive numbers

### Median Calculation Errors

1. Ensure at least one vote exists
2. Check that all allocations have valid amounts
3. Verify session has categories defined
4. Review validation errors in API response

## Support

For issues or questions about the budget module:
1. Check the main Equal Democracy documentation
2. Review API endpoint responses for error messages
3. Check browser console for client-side errors
4. Verify environment variables are set correctly
