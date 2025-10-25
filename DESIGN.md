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

### Data Storage Schema

#### Transactions Table
```javascript
{
  id: "uuid",
  date: "YYYY-MM-DD",
  description: "string",
  amount: number (negative for debits, positive for credits),
  memo: "string",
  account: "string",
  categoryId: "uuid | null",
  source: "format1 | format2", // which CSV format imported from
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
  id: "uuid",
  pattern: "string", // text to match (partial, case-insensitive)
  categoryId: "uuid",
  matchField: "description | memo | both",
  priority: number, // for conflict resolution
  createdDate: "timestamp"
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

### Phase 1: MVP (Current)
1. **CSV Import**
   - Detect format automatically
   - Parse and normalize both CSV formats
   - Deduplicate transactions on import
   - Show import preview before committing

2. **Manual Categorization**
   - Assign categories to individual transactions
   - Bulk categorization (select multiple)
   - Quick category assignment UI

3. **Auto-Categorization**
   - Create rules based on text matching
   - Partial match support (e.g., "APPLE.COM" matches category)
   - Apply rules to uncategorized transactions
   - "Learn from this" button to create rules from manual categorization

4. **Category Management**
   - Pre-configured groups: His, Hers, Pets, Shared, Transfers
   - Add/edit/delete categories within groups
   - Color coding for visual distinction

5. **Data Export**
   - Export entire database as JSON
   - Import from exported JSON
   - Migration-friendly format

### Phase 2: Future Enhancements (Not in MVP)
- Budget limits per category
- Spending trends and charts
- Monthly/yearly summaries
- Transaction search and filtering
- Split transactions across categories
- Recurring transaction detection
- Custom date range views

## UI/UX Design

### Layout
- **Header**: App title, import button, export button, settings
- **Sidebar**: Category list with totals, filters
- **Main Area**: Transaction table with inline categorization
- **Modal Overlays**: Import preview, category editor, rule creator

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
   - Click "Import CSV" → File picker → Format detection → Preview table → Confirm import

2. **Categorization Flow**
   - Click transaction → Category dropdown → Select → Auto-save
   - OR: Select multiple → Bulk categorize button → Select category → Apply

3. **Rule Creation Flow**
   - Categorize transaction → "Create rule" button → Edit pattern → Save
   - OR: Category management → Add rule → Define pattern → Save

## Data Migration Strategy

### Future-Proofing
- Store original CSV data in `rawData` field
- Use semantic versioning for export format
- Include schema version in exports
- Write migration functions for schema changes

### Export Format
```javascript
{
  version: "1.0.0",
  exportDate: "timestamp",
  data: {
    transactions: [],
    categories: [],
    rules: []
  }
}
```

## Technical Considerations

### Deduplication Strategy
- Generate hash from: date + description + amount
- Check hash before inserting new transaction
- Warn user of duplicates during import

### Performance
- IndexedDB indexes on: date, categoryId, amount
- Virtual scrolling for large transaction lists (future)
- Lazy load transactions by date range (future)

### Browser Compatibility
- Target: Modern browsers with IndexedDB support (Chrome, Firefox, Safari, Edge)
- No IE11 support required

## Development Approach

### File Structure
```
/MoneyTracker
  index.html          # Main app HTML
  styles.css          # Dark mode styles
  app.js              # Main application logic
  db.js               # IndexedDB wrapper
  csv-parser.js       # CSV parsing utilities
  categories.js       # Category management
  rules.js            # Auto-categorization engine
  DESIGN.md           # This file
  README.md           # User-facing documentation
```

### Testing Strategy
- Manual testing with sample CSV files
- Test both CSV formats thoroughly
- Test edge cases: empty files, malformed CSVs, duplicates
- Test export/import roundtrip

## Open Questions & Decisions

### Decisions Made
- ✅ Local-only (no backend)
- ✅ IndexedDB for storage
- ✅ Dark mode default
- ✅ Two-tier category structure (Group > Category)
- ✅ Partial text matching for rules
- ✅ JSON export format

### To Be Decided (Future)
- Date format preferences (US vs international)
- Currency symbols/localization
- Mobile responsiveness priority
- Keyboard shortcuts
