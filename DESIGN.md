# MoneyTracker Design Document

## Overview
MoneyTracker is a local-first budgeting and transaction tracking application that runs entirely in the browser. No server required, no cloud dependencies.

## Core Principles
- **Privacy First**: All data stays on the user's device
- **Simple & Focused**: Start with essential features, expand iteratively
- **Portable**: Easy export/import for data migration
- **Dark Mode**: Easy on the eyes for financial review sessions

## Architecture

### Technology Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6+)
- **Storage**: IndexedDB for structured data persistence
- **UI**: Dark mode CSS with responsive design
- **Charts**: Chart.js for dashboard visualizations
- **AI/ML**: Custom similarity matching and pattern recognition engine

### Data Storage Schema

#### Transactions Table
```javascript
{
  id: number,
  date: "YYYY-MM-DD",
  description: "string",
  amount: number (negative for debits, positive for credits),
  memo: "string",
  account: "string",
  categoryId: number | null,
  isSplit: boolean,
  splits: [{ categoryId: number, percentage: number, amount: number }],
  hash: "string", // for deduplication
  pendingReview: boolean, // smart categorization suggestion pending
  suggestionConfidence: number (0-100), // confidence score for suggestion
  suggestionReasoning: "string", // human-readable explanation
  suggestionPatternId: number, // reference to pattern that created suggestion
  rawData: {} // original CSV row for reference
}
```

#### Categories Table
```javascript
{
  id: "uuid",
  name: "string",
  parent: "His | Hers | Pets | Shared | null",
  color: "hex color"
}
```

#### Auto-Categorization Rules Table
```javascript
{
  id: number,
  pattern: "string", // text to match (partial, case-insensitive)
  categoryId: number,
  matchField: "description | memo | both",
  priority: number, // for conflict resolution
  createdDate: "timestamp"
}
```

#### Templates Table
```javascript
{
  id: number,
  name: "string", // template name (e.g., "Walmart Groceries")
  merchant: "string", // merchant identifier for auto-suggestion
  splits: [{ categoryId: number, percentage: number }],
  isDefault: boolean, // pre-built vs user-created
  createdDate: "timestamp"
}
```

#### Patterns Table (Smart Categorization)
```javascript
{
  id: number,
  merchantName: "string", // normalized merchant name
  categoryId: number,
  matchCount: number, // times this pattern appeared
  acceptCount: number, // times user accepted suggestion
  denyCount: number, // times user rejected suggestion
  lastSeen: "timestamp",
  amountMin: number,
  amountMax: number,
  isRecurring: boolean,
  recurrencePattern: "monthly | null"
}
```

### CSV Format Support

#### Format 1 (Primary Bank)
```csv
"Date","Transaction","Name","Memo","Amount"
```
- Date: Transaction date
- Transaction: Type (DEBIT/CREDIT)
- Name: Merchant/payee description
- Memo: Transaction details/reference numbers
- Amount: Negative for debits, positive for credits

#### Format 2 (Secondary Bank)
```csv
Account,ChkRef,Debit,Credit,Balance,Date,Description
```
- Debit: Debit amount (if applicable)
- Credit: Credit amount (if applicable)
- Date: Transaction date
- Description: Merchant/transaction description

## Features

### Implemented Features
1. **CSV Import**
   - Automatic format detection
   - Parse and normalize multiple CSV formats
   - Hash-based deduplication on import
   - Import preview before committing
   - Preserves original raw data

2. **Manual Categorization**
   - Assign categories to individual transactions
   - Bulk categorization (select multiple)
   - Quick inline category assignment UI
   - Undo/redo support for changes

3. **Rule-Based Auto-Categorization**
   - Create rules based on text matching
   - Partial match support with case-insensitive matching
   - Apply rules to uncategorized transactions
   - Priority-based conflict resolution
   - "Learn from this" button to create rules from manual categorization

4. **Smart AI Categorization**
   - Pattern mining from transaction history
   - Merchant name normalization and similarity matching
   - Confidence scoring (0-100) for suggestions
   - Amount range matching
   - Recurring transaction detection
   - Accept/reject feedback loop for continuous improvement
   - Human-readable reasoning for suggestions

5. **Split Transactions**
   - Split transactions across multiple categories
   - Percentage-based allocation (must sum to 100%)
   - Automatic amount calculation from percentages
   - Handles rounding errors intelligently

6. **Transaction Templates**
   - Pre-built templates for common merchants (Walmart, Target, Amazon, Costco, etc.)
   - User-created custom templates
   - Auto-suggestion based on merchant name
   - Save templates from existing split transactions

7. **Analytics Dashboard**
   - Spending by category (doughnut chart)
   - Spending over time (line chart)
   - Top spending categories
   - Summary statistics
   - Flexible time period filters (30/60/90 days, 6 months, year, all time)
   - Export data from dashboard

8. **Category Management**
   - Pre-configured groups: His, Hers, Pets, Shared, Transfers
   - Add/edit/delete categories within groups
   - Color coding for visual distinction
   - Transaction count per category

9. **Data Export/Import**
   - Export entire database as JSON with versioning
   - Import from exported JSON
   - Migration-friendly format
   - Preserves all data including rules, templates, and patterns

### Future Enhancements
- Budget limits and alerts per category
- Monthly/yearly summary reports
- Advanced transaction search and filtering
- Custom date range views
- Multi-currency support
- Mobile-optimized UI
- Keyboard shortcuts
- Spending predictions based on historical data

## UI/UX Design

### Layout

**Main Transaction View (index.html)**
- **Header**: App title, import button, export button, dashboard link
- **Sidebar**: Category list with totals, filters, uncategorized count
- **Main Area**: Transaction table with inline categorization, split indicators
- **Modal Overlays**: Import preview, category editor, rule creator, split editor, template selector

**Dashboard View (dashboard.html)**
- **Header**: App title, back to transactions link, export button
- **Filter Bar**: Time period selector
- **Grid Layout**:
  - Spending by Category chart (doughnut)
  - Spending Over Time chart (line)
  - Top Categories list
  - Summary statistics

### Dark Mode Theme
- Background: `#1a1a1a` (dark gray)
- Surface: `#2d2d2d` (lighter gray)
- Text: `#e0e0e0` (light gray)
- Accent: `#4a9eff` (blue)
- Success: `#4caf50` (green)
- Warning: `#ff9800` (orange)
- Error: `#f44336` (red)

### Key Interactions
1. **Import Flow**
   - Click "Import CSV" → File picker → Format detection → Preview table → Confirm import → Smart categorization runs automatically

2. **Manual Categorization Flow**
   - Click transaction → Category dropdown → Select → Auto-save
   - OR: Select multiple → Bulk categorize button → Select category → Apply

3. **Smart Categorization Flow**
   - Import transactions → Pattern mining → Auto-suggestions applied with confidence scores
   - Review pending suggestions (highlighted in UI)
   - Accept (checkmark) or Reject (X) → Feedback improves future suggestions

4. **Rule Creation Flow**
   - Categorize transaction → "Create rule" button → Edit pattern → Save
   - OR: Category management → Add rule → Define pattern → Save

5. **Split Transaction Flow**
   - Select transaction → "Split" button → Choose template OR manual entry
   - Add categories and percentages → Percentages must sum to 100% → Save
   - Option to save as template for future use

6. **Dashboard Flow**
   - Click "Dashboard" in header → View charts and statistics
   - Adjust time period filter → Charts update dynamically
   - Click "Back to Transactions" to return to main view

## Smart Categorization Algorithm

### Overview
The SmartCategorizationEngine uses pattern recognition and machine learning concepts to automatically suggest categories for transactions based on historical user behavior.

### Core Components

#### 1. Merchant Normalization
- Cleans up bank transaction descriptions to extract merchant names
- Removes location numbers, state codes, and reference IDs
- Maps common variations to canonical names (e.g., "AMZN MKTP" → "Amazon")
- Handles common prefixes: TST*, SQ*, POS, DEBIT, CREDIT
- Normalizes to consistent format for matching

#### 2. Similarity Scoring
- **Exact Match**: 100 points - Identical merchant names
- **Contains Match**: 85 points - One string contains the other
- **Levenshtein Distance**: 0-100 points based on string edit distance
- Used to match new transactions against historical patterns

#### 3. Pattern Mining
- Analyzes all categorized, non-split transactions
- Groups by merchant name and category
- Tracks amount ranges (min/max)
- Detects recurring patterns (monthly bills, subscriptions)
- Stores in Patterns table for future matching

#### 4. Confidence Calculation (0-100)
Confidence is calculated from multiple factors:
- **Historical Matches** (0-40 points): More occurrences = higher confidence
- **Merchant Similarity** (0-30 points): How closely merchant names match
- **Amount Matching** (0-20 points):
  - Exact amount: 20 points
  - In range: 15 points
  - Close to range (±10%): 10 points
- **Recurring Pattern** (0-10 points): Bonus for detected recurring transactions
- **Accept/Reject Ratio** (-20 to +10 points): User feedback modifier
  - 90%+ acceptance: +10 points
  - <50% acceptance: -20 points

#### 5. Feedback Loop
- User accepts suggestion → `acceptCount++` → Higher confidence for pattern
- User rejects suggestion → `denyCount++` → Lower confidence for pattern
- Patterns with poor accept ratios are downweighted
- System continuously learns from user behavior

### Confidence Threshold
- Default: 70% confidence required for auto-suggestion
- User configurable (0-100)
- Below threshold: No suggestion shown
- Above threshold: Category suggested with "pending review" flag

### Pattern Matching Process
1. New transaction imported
2. Normalize merchant name from description
3. Compare against all stored patterns
4. Calculate confidence score for each potential match
5. Select best match (highest confidence)
6. If confidence ≥ threshold, apply suggestion with pendingReview flag
7. User reviews and accepts/rejects
8. Feedback updates pattern statistics

### Recurring Transaction Detection
- Analyzes transaction dates for similar merchant/amount combinations
- Checks for monthly patterns (same day ±3 days each month)
- Requires minimum 2 historical occurrences
- Flags patterns as recurring for bonus confidence

## Data Migration Strategy

### Future-Proofing
- Store original CSV data in `rawData` field
- Use semantic versioning for export format
- Include schema version in exports
- Write migration functions for schema changes

### Export Format
```javascript
{
  version: "2.0.0",
  exportDate: "timestamp",
  data: {
    transactions: [],      // includes splits and suggestion metadata
    categories: [],
    rules: [],
    templates: [],         // split transaction templates
    patterns: []           // smart categorization patterns
  }
}
```

## Technical Considerations

### Deduplication Strategy
- Generate hash from: date + description + amount
- Check hash before inserting new transaction
- Warn user of duplicates during import

### Performance
- IndexedDB indexes on: date, categoryId, amount, hash
- Pattern matching optimized with early returns
- Chart rendering uses Chart.js with efficient data structures
- Split transaction calculations cached in transaction object
- Merchant normalization memoization for repeated lookups
- Future optimizations:
  - Virtual scrolling for large transaction lists
  - Lazy load transactions by date range
  - Web Worker for pattern mining on large datasets

### Browser Compatibility
- Target: Modern browsers with IndexedDB support (Chrome, Firefox, Safari, Edge)
- No IE11 support required

## Development Approach

### File Structure
```
/MoneyTracker
  index.html                # Main transaction view HTML
  dashboard.html            # Dashboard/analytics view HTML
  styles.css                # Dark mode styles and responsive design
  app.js                    # Main application controller
  dashboard.js              # Dashboard controller and chart rendering
  db.js                     # IndexedDB wrapper with all CRUD operations
  csv-parser.js             # Multi-format CSV parsing utilities
  categories.js             # Category management and hierarchy
  rules.js                  # Rule-based auto-categorization engine
  templates.js              # Split transaction template manager
  smart-categorization.js   # AI-powered pattern recognition and learning
  DESIGN.md                 # This file - technical design document
  README.md                 # User-facing documentation
  CLAUDE.md                 # AI assistant instructions for development
```

### Testing Strategy
- Manual testing with sample CSV files from multiple banks
- Test both CSV formats thoroughly
- Test edge cases: empty files, malformed CSVs, duplicates
- Test export/import roundtrip with all data types
- Test split transaction percentage validation
- Test smart categorization with various merchant name formats
- Test pattern learning and suggestion accuracy
- Test dashboard charts with different time periods
- Test template application and saving

## Open Questions & Decisions

### Decisions Made
- ✅ Local-only (no backend, no cloud)
- ✅ IndexedDB for storage with multiple object stores
- ✅ Dark mode default
- ✅ Two-tier category structure (Group > Category)
- ✅ Partial text matching for rules
- ✅ JSON export format with versioning
- ✅ Hash-based deduplication (date + description + amount)
- ✅ Percentage-based splits (must sum to 100%)
- ✅ Confidence threshold (0-100) for smart categorization
- ✅ Chart.js for dashboard visualizations
- ✅ Levenshtein distance for merchant similarity matching
- ✅ Accept/reject feedback loop for ML improvement

### To Be Decided (Future)
- Date format preferences (US vs international)
- Currency symbols/localization
- Mobile responsiveness priority
- Keyboard shortcuts
- Budget limits implementation approach
- Spending predictions algorithm
- Multi-account support
