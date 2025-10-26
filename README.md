# MoneyTracker

A simple, privacy-focused budgeting and transaction tracking app that runs entirely in your browser. No accounts, no cloud, no tracking.

## Features

- **Import CSV files** from your bank or credit card
- **Smart auto-categorization** - AI-powered learning engine that suggests categories based on your past behavior
- **Manual categorization** with inline editing and bulk operations
- **Rule-based categorization** to automatically sort similar transactions
- **Split transactions** across multiple categories with percentage-based allocation
- **Transaction templates** for common merchants (Walmart, Target, Amazon, etc.)
- **Interactive dashboard** with charts showing spending by category and over time
- **Track spending** across His/Hers/Pets/Shared/Transfers budget categories
- **Export your data** for backup or migration to another device
- **Dark mode** for comfortable viewing

## Getting Started

1. Open `index.html` in your web browser to access the main transaction view
2. Click "Import CSV" to upload your bank statement
3. Review the imported transactions
4. Start categorizing (manually, with rules, or using smart suggestions)
5. Open `dashboard.html` to view your spending analytics

**Quick Start Tips:**
- Let the smart categorization engine learn from your first 50-100 manual categorizations
- Use templates for stores where you regularly buy from multiple categories
- Check the dashboard regularly to track spending trends

## Supported CSV Formats

### Format 1 (Standard Bank Export)
```csv
"Date","Transaction","Name","Memo","Amount"
"2025-09-25","DEBIT","APPLE.COM/BILL","Reference","−12.99"
```

### Format 2 (Alternative Bank Export)
```csv
Account,ChkRef,Debit,Credit,Balance,Date,Description
CheckingAcct,1234,12.99,,,2025-09-25,APPLE.COM/BILL
```

The app automatically detects which format you're using.

## How to Use

### Importing Transactions
1. Download CSV files from your bank or credit card website
2. Click the "Import CSV" button in MoneyTracker
3. Select your CSV file
4. Review the preview and click "Import" to add transactions

### Categorizing Transactions
1. Click on a transaction to open the category dropdown
2. Select a category
3. The transaction is automatically saved

**Tip**: Select multiple transactions and use "Bulk Categorize" to assign them all at once!

### Smart Auto-Categorization
MoneyTracker learns from your categorization patterns and automatically suggests categories for new transactions.

**How it works:**
1. Categorize transactions normally (manually or with rules)
2. The system learns merchant patterns, amounts, and recurring transactions
3. Future similar transactions get automatic suggestions with confidence scores
4. Review and accept/reject suggestions to improve accuracy over time

**Pattern Mining:**
- Click "Mine Patterns" to analyze your transaction history
- The engine identifies merchants, amounts, and recurring patterns
- Builds a learning model that improves with more data

### Creating Manual Categorization Rules
After manually categorizing a transaction, click "Create Rule" to automatically categorize similar transactions in the future.

Rules use partial text matching, so:
- Rule pattern: "APPLE.COM" will match "APPLE.COM/BILL", "APPLE.COM/US", etc.
- Rule pattern: "EVERYDAY" will match "EVERYDAY 30576015M", "EVERYDAY GROCERY", etc.

### Split Transactions
Some purchases include items from multiple categories (e.g., groceries + pet food at Target).

**Creating a split:**
1. Select a transaction
2. Click "Split Transaction"
3. Add categories and percentages (must sum to 100%)
4. Amounts are automatically calculated

**Using templates:**
- Pre-built templates for common stores (Walmart, Target, Amazon, Costco, etc.)
- Save your own custom templates from any split transaction
- Auto-suggested based on merchant name in description

### Viewing the Dashboard
Open `dashboard.html` to see your spending analytics:
- **Spending by Category** - Doughnut chart showing category breakdown
- **Spending Over Time** - Line chart tracking spending trends
- **Top Categories** - Your highest spending categories
- **Summary Statistics** - Total spending, average per transaction, and more

Filter by time period: Last 30/60/90 days, 6 months, year, or all time.

### Managing Categories
The app comes with basic category groups:
- **His**: Personal expenses
- **Hers**: Personal expenses
- **Pets**: Pet-related expenses
- **Shared**: Joint expenses
- **Transfers**: Account transfers, credit card payments, savings moves (not "real" spending)

You can add custom categories within each group in the Category Manager.

### Exporting Your Data
Click "Export Data" to download a JSON file containing all your transactions, categories, and rules. This file can be imported on another device to migrate your data.

## Privacy & Data

All data is stored locally in your browser using IndexedDB. Nothing is sent to any server. Your financial data never leaves your device.

### Data Location
- **Chrome/Edge**: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB`
- **Firefox**: `%APPDATA%\Mozilla\Firefox\Profiles\[profile]\storage`
- **Safari**: `~/Library/Safari/Databases`

### Backup Recommendations
Regularly export your data (Export button) and save the JSON file somewhere safe:
- Cloud storage (if you trust it)
- External drive
- USB stick

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 60+
- Firefox 58+
- Safari 13+

## Development

This is a single-page application with no build process required. Just open `index.html`.

### File Structure
```
/MoneyTracker
  index.html                # Main transaction view
  dashboard.html            # Analytics dashboard
  styles.css                # Dark mode styling
  app.js                    # Main application logic
  dashboard.js              # Dashboard and charts
  db.js                     # IndexedDB operations
  csv-parser.js             # CSV format detection and parsing
  categories.js             # Category management
  rules.js                  # Rule-based auto-categorization
  templates.js              # Split transaction templates
  smart-categorization.js   # AI-powered learning engine
```

### Future Features (Planned)
- Budget limits and alerts per category
- Monthly/yearly summary reports
- Advanced filtering and search
- Custom date range views
- Multi-currency support
- Additional CSV format support

## Troubleshooting

**Q: My import isn't working**
- Make sure your CSV matches one of the supported formats
- Try opening the CSV in a text editor to check formatting
- Check browser console for error messages

**Q: Where is my data stored?**
- In your browser's IndexedDB. It persists even after closing the browser.

**Q: How do I move my data to a new computer?**
- Use the Export button to download your data
- Open MoneyTracker on the new computer
- Use the Import button to upload your exported JSON file

**Q: Can I use this on mobile?**
- The app works on mobile browsers, but the UI is optimized for desktop currently

## License

This is personal software. Use it however you like!

## Contributing

This is a personal project, but feel free to fork and customize for your own needs.
