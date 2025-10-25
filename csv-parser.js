/**
 * CSV Parser for MoneyTracker
 * Supports two bank CSV formats
 */

class CSVParser {
    /**
     * Parse CSV text and detect format
     * @param {string} csvText - Raw CSV text
     * @returns {Object} { format: string, transactions: Array }
     */
    static parse(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const header = lines[0];

        // Detect format
        if (header.includes('"Date","Transaction","Name","Memo","Amount"')) {
            return this.parseFormat1(lines);
        } else if (header.includes('Account') && header.includes('Debit') && header.includes('Credit')) {
            return this.parseFormat2(lines);
        } else {
            throw new Error('Unrecognized CSV format. Please check the file.');
        }
    }

    /**
     * Parse Format 1: "Date","Transaction","Name","Memo","Amount"
     */
    static parseFormat1(lines) {
        const transactions = [];

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const row = this.parseCSVLine(line);

                if (row.length < 5) continue; // Skip malformed rows

                const [date, transaction, name, memo, amount] = row;

                transactions.push({
                    date: this.parseDate(date),
                    description: name,
                    memo: memo,
                    amount: parseFloat(amount.replace(/[^0-9.-]/g, '')),
                    account: 'Primary Account',
                    source: 'format1',
                    rawData: { date, transaction, name, memo, amount }
                });
            } catch (error) {
                console.warn('Skipping malformed row:', line, error);
            }
        }

        return {
            format: 'format1',
            transactions
        };
    }

    /**
     * Parse Format 2: Account,ChkRef,Debit,Credit,Balance,Date,Description
     */
    static parseFormat2(lines) {
        const transactions = [];

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const row = this.parseCSVLine(line);

                if (row.length < 7) continue; // Skip malformed rows

                const [account, chkRef, debit, credit, balance, date, description] = row;

                // Determine amount (debit is negative, credit is positive)
                let amount = 0;
                if (debit && debit.trim() !== '') {
                    amount = -Math.abs(parseFloat(debit.replace(/[^0-9.]/g, '')));
                } else if (credit && credit.trim() !== '') {
                    amount = Math.abs(parseFloat(credit.replace(/[^0-9.]/g, '')));
                }

                transactions.push({
                    date: this.parseDate(date),
                    description: description,
                    memo: chkRef,
                    amount: amount,
                    account: account || 'Unknown Account',
                    source: 'format2',
                    rawData: { account, chkRef, debit, credit, balance, date, description }
                });
            } catch (error) {
                console.warn('Skipping malformed row:', line, error);
            }
        }

        return {
            format: 'format2',
            transactions
        };
    }

    /**
     * Parse a single CSV line, handling quoted fields
     * @param {string} line - CSV line
     * @returns {Array<string>} Array of field values
     */
    static parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current);

        return result;
    }

    /**
     * Parse date string to YYYY-MM-DD format
     * @param {string} dateStr - Date string in various formats
     * @returns {string} Date in YYYY-MM-DD format
     */
    static parseDate(dateStr) {
        // Try parsing as YYYY-MM-DD first
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // Try parsing as MM/DD/YYYY
        const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const match = dateStr.match(mmddyyyy);
        if (match) {
            const [, month, day, year] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Fallback: try Date.parse
        const parsed = new Date(dateStr);
        if (!isNaN(parsed)) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        throw new Error(`Unable to parse date: ${dateStr}`);
    }

    /**
     * Generate a hash for transaction deduplication
     * @param {Object} transaction - Transaction object
     * @returns {string} Hash string
     */
    static generateHash(transaction) {
        const str = `${transaction.date}|${transaction.description}|${transaction.amount}`;
        return this.simpleHash(str);
    }

    /**
     * Simple string hash function
     * @param {string} str - String to hash
     * @returns {string} Hash as hexadecimal string
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Format amount for display
     * @param {number} amount - Amount to format
     * @returns {string} Formatted amount
     */
    static formatAmount(amount) {
        const formatted = Math.abs(amount).toFixed(2);
        return amount < 0 ? `-$${formatted}` : `$${formatted}`;
    }

    /**
     * Format date for display
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    static formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}
