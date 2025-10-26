# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MoneyTracker is a privacy-focused, local-first budgeting and transaction tracking application that runs entirely in the browser. All data is stored locally using IndexedDB - no server, no cloud, no tracking.

## Running the Application

This is a vanilla JavaScript single-page application with no build process.

- **Run locally**: Open `index.html` in a web browser
- **Dashboard**: Open `dashboard.html` for spending analytics and charts
- **No package manager**: No npm install, no build step required

## Architecture

### Core Classes & Responsibilities

**MoneyTrackerDB** (db.js)
- IndexedDB wrapper managing all data persistence
- Stores: `transactions`, `categories`, `rules`, `templates`
- Handles import/export of all data as JSON
- Uses hash-based deduplication for transactions

**MoneyTrackerApp** (app.js)
- Main application controller for transaction view
- Coordinates between CategoryManager, RulesEngine, and TemplateManager
- Manages UI state and event handlers
- Handles transaction display, selection, and bulk operations

**CategoryManager** (categories.js)
- Manages category hierarchy with 5 groups: His, Hers, Pets, Shared, Transfers
- Creates default categories on first run
- Handles category CRUD and counts per category
- Split transactions can have multiple categories

**RulesEngine** (rules.js)
- Auto-categorization based on pattern matching
- Rules match against transaction description/memo using partial text matching
- Sorted by priority, first match wins
- Can suggest rules based on existing transactions

**TemplateManager** (templates.js)
- Manages split transaction templates for stores like Walmart, Target, Amazon
- Templates define percentage splits across multiple categories
- Auto-suggests templates based on merchant name in description
- Users can save custom templates from existing splits

**CSVParser** (csv-parser.js)
- Parses two different CSV formats automatically
- Format 1: "Date","Transaction","Name","Memo","Amount"
- Format 2: Account,ChkRef,Debit,Credit,Balance,Date,Description
- Generates hashes for duplicate detection

**Dashboard** (dashboard.js)
- Read-only analytics view using Chart.js
- Shows spending by category (doughnut chart)
- Shows spending over time (line chart)
- Displays top categories and summary statistics

### Data Flow

1. **Import**: CSV → CSVParser → MoneyTrackerDB (with deduplication) → MoneyTrackerApp
2. **Categorization**: User selects category → Transaction updated → DB persisted → UI refreshed
3. **Rules**: User creates rule → RulesEngine stores → Apply to uncategorized → DB updated
4. **Splits**: User creates split → Calculate amounts from percentages → Store in transaction → UI updates
5. **Export**: MoneyTrackerDB → JSON file with version info

### Key Data Structures

**Transaction Object**:
```javascript
{
  id: number,
  date: "YYYY-MM-DD",
  description: string,
  memo: string,
  amount: number,  // negative = debit, positive = credit
  categoryId: number | null,
  isSplit: boolean,
  splits: [{ categoryId, percentage, amount }],
  hash: string,    // for deduplication
  rawData: {}      // original CSV data
}
```

**Split Object** (within transactions):
```javascript
{
  categoryId: number,
  percentage: number,  // must sum to 100%
  amount: number       // calculated from percentage and total
}
```

## Common Development Tasks

### Adding a New Category Group

1. Update HTML in index.html to add the new group section
2. Add group name to `CategoryManager.getGroupedCategories()` in categories.js:181
3. Update category manager modal in index.html with new group option
4. Optionally add default categories in `CategoryManager.createDefaultCategories()` in categories.js:82

### Supporting a New CSV Format

1. Add format detection logic in `CSVParser.parse()` in csv-parser.js:12
2. Implement `parseFormatN()` method following existing patterns in csv-parser.js:33 and csv-parser.js:71
3. Ensure normalized output matches transaction structure

### Modifying the Data Schema

1. Update IndexedDB version in `MoneyTrackerDB.constructor()` in db.js:9
2. Add migration logic in `onupgradeneeded` handler in db.js:32
3. Update export format version in `exportData()` in db.js:361
4. Add backward compatibility handling in `importData()` in db.js:375

### Working with Split Transactions

- Splits are stored directly on the transaction object in a `splits` array
- When `isSplit` is true, `categoryId` should be null
- Percentages must sum to 100% (validated in UI)
- Amount calculations handle both positive and negative transactions
- Rounding errors are adjusted on the last split in templates.js:244

## Important Implementation Details

### Deduplication Strategy
- Hash generated from `date|description|amount` in csv-parser.js:188
- Checked before insert using IndexedDB hash index in db.js:103
- Import shows count of duplicates skipped

### Category Counting with Splits
- Regular transactions count once toward their category
- Split transactions count toward each split category
- Uncategorized excludes split transactions (they always have categories via splits)
- See categories.js:202 for implementation

### Auto-Categorization Rules
- Case-insensitive partial matching in rules.js:99
- Rules sorted by priority, first match wins
- Only applied to uncategorized transactions (rules.js:120)
- Can match on description, memo, or both fields

### Template System
- Default templates created on first run for common stores
- Templates store percentages, amounts calculated at application time
- Merchant name extracted from description for auto-suggestion
- Users can save custom templates from any split transaction

## Database Schema

The application uses IndexedDB with the following stores:

**transactions**: Auto-increment ID, indexed on date, categoryId, amount, hash
**categories**: Auto-increment ID, indexed on parent group
**rules**: Auto-increment ID, indexed on categoryId and priority
**templates**: Auto-increment ID, indexed on name and merchant

## UI Patterns

### Modal System
- All modals use `.modal` class with `.hidden` state
- Modals close via X button, Cancel button, or clicking backdrop
- `closeAllModals()` in app.js:1318 clears all modal states

### Selection System
- Transactions can be individually or bulk selected
- "Select All" only affects currently displayed/filtered transactions
- Selection state persists across renders using `selectedTransactions` Set in app.js:13
- Bulk operations: categorize, split

### Category Filtering
- Click category in sidebar to filter transactions
- Highlights active filter with `.active` class
- Search clears category highlights and shows matching transactions

## Testing Recommendations

- Test both CSV formats with sample bank data
- Verify duplicate detection by importing same file twice
- Test split transaction percentages summing to 100%
- Test rule priority and matching logic with overlapping patterns
- Verify export/import round-trip preserves all data
- Test category deletion behavior (transactions reference deleted category)
