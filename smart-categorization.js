/**
 * Smart Auto-Categorization Engine for MoneyTracker
 * Learns from user behavior to automatically suggest categories
 */

class SmartCategorizationEngine {
    constructor(db) {
        this.db = db;
        this.patterns = [];
        this.confidenceThreshold = 70; // Minimum confidence to auto-apply (0-100)
    }

    /**
     * Initialize the engine
     */
    async init() {
        this.patterns = await this.db.getPatterns();
        return this.patterns;
    }

    /**
     * Normalize merchant names from transaction descriptions
     * Handles common bank description formats
     */
    normalizeMerchant(description) {
        if (!description) return '';

        let normalized = description.trim();

        // Common patterns to clean up
        const cleanupPatterns = [
            // Remove store/location numbers
            /#\d+/g,
            /\s+\d{3,5}\s*$/,

            // Remove location info (state codes, cities)
            /\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/i,

            // Remove common prefixes
            /^TST\*\s*/i,
            /^SQ\s*\*\s*/i,
            /^AMZN\s+MKTP\s+US\*/i,
            /^POS\s+/i,
            /^DEBIT\s+/i,
            /^CREDIT\s+/i,

            // Remove trailing reference numbers
            /\s+[A-Z0-9]{8,}\s*$/,

            // Remove dates
            /\s+\d{1,2}\/\d{1,2}\/\d{2,4}/g,
            /\s+\d{1,2}-\d{1,2}-\d{2,4}/g,
        ];

        cleanupPatterns.forEach(pattern => {
            normalized = normalized.replace(pattern, '');
        });

        // Handle specific merchants
        const merchantMappings = [
            { pattern: /walmart/i, name: 'Walmart' },
            { pattern: /target/i, name: 'Target' },
            { pattern: /starbucks/i, name: 'Starbucks' },
            { pattern: /amazon/i, name: 'Amazon' },
            { pattern: /netflix/i, name: 'Netflix' },
            { pattern: /spotify/i, name: 'Spotify' },
            { pattern: /shell/i, name: 'Shell' },
            { pattern: /chevron/i, name: 'Chevron' },
            { pattern: /costco/i, name: 'Costco' },
            { pattern: /safeway/i, name: 'Safeway' },
            { pattern: /kroger/i, name: 'Kroger' },
            { pattern: /whole\s*foods/i, name: 'Whole Foods' },
            { pattern: /trader\s*joe/i, name: 'Trader Joes' },
            { pattern: /home\s*depot/i, name: 'Home Depot' },
            { pattern: /lowes/i, name: 'Lowes' },
            { pattern: /best\s*buy/i, name: 'Best Buy' },
        ];

        for (const mapping of merchantMappings) {
            if (mapping.pattern.test(normalized)) {
                return mapping.name;
            }
        }

        // Clean up whitespace and convert to title case
        normalized = normalized.replace(/\s+/g, ' ').trim();

        // Take only the first significant part (before multiple spaces or special chars)
        const parts = normalized.split(/\s{2,}|\t/);
        normalized = parts[0];

        // Limit length
        if (normalized.length > 40) {
            normalized = normalized.substring(0, 40).trim();
        }

        return normalized;
    }

    /**
     * Calculate similarity score between two strings (0-100)
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        // Exact match
        if (s1 === s2) return 100;

        // One contains the other
        if (s1.includes(s2) || s2.includes(s1)) return 85;

        // Levenshtein distance (simple implementation)
        const distance = this.levenshteinDistance(s1, s2);
        const maxLen = Math.max(s1.length, s2.length);
        const similarity = ((maxLen - distance) / maxLen) * 100;

        return Math.max(0, similarity);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Detect if a transaction is recurring based on amount and date pattern
     */
    detectRecurringPattern(transaction, historicalTransactions) {
        const amount = Math.abs(transaction.amount);
        const merchantName = this.normalizeMerchant(transaction.description);

        // Find similar transactions (same merchant, similar amount within ±10%)
        const similarTransactions = historicalTransactions.filter(t => {
            const tAmount = Math.abs(t.amount);
            const tMerchant = this.normalizeMerchant(t.description);

            const amountMatch = Math.abs(tAmount - amount) <= amount * 0.1;
            const merchantMatch = this.calculateSimilarity(merchantName, tMerchant) > 70;

            return amountMatch && merchantMatch && t.id !== transaction.id;
        });

        if (similarTransactions.length < 2) {
            return { isRecurring: false, pattern: null };
        }

        // Analyze date patterns
        const dates = similarTransactions.map(t => new Date(t.date)).sort((a, b) => a - b);

        // Check for monthly pattern (within ±3 days of same day each month)
        const dayOfMonth = dates.map(d => d.getDate());
        const avgDay = dayOfMonth.reduce((sum, day) => sum + day, 0) / dayOfMonth.length;
        const dayVariance = dayOfMonth.every(day => Math.abs(day - avgDay) <= 3);

        if (dayVariance && similarTransactions.length >= 2) {
            return { isRecurring: true, pattern: 'monthly' };
        }

        return { isRecurring: false, pattern: null };
    }

    /**
     * Mine patterns from categorized transactions
     * Builds merchant-to-category mappings
     */
    async minePatterns(transactions) {
        const patternMap = new Map();

        // Only look at categorized, non-split transactions
        const categorizedTransactions = transactions.filter(t =>
            t.categoryId && !t.isSplit && !t.pendingReview
        );

        categorizedTransactions.forEach(transaction => {
            const merchantName = this.normalizeMerchant(transaction.description);
            if (!merchantName) return;

            const key = `${merchantName}|${transaction.categoryId}`;

            if (!patternMap.has(key)) {
                patternMap.set(key, {
                    merchantName,
                    categoryId: transaction.categoryId,
                    transactions: [],
                    amounts: []
                });
            }

            const pattern = patternMap.get(key);
            pattern.transactions.push(transaction);
            pattern.amounts.push(Math.abs(transaction.amount));
        });

        // Convert to patterns and update database
        const patterns = [];
        for (const [key, data] of patternMap.entries()) {
            const amounts = data.amounts.sort((a, b) => a - b);
            const pattern = {
                merchantName: data.merchantName,
                categoryId: data.categoryId,
                matchCount: data.transactions.length,
                acceptCount: data.transactions.length, // Initially all accepted
                denyCount: 0,
                lastSeen: new Date().toISOString(),
                amountMin: Math.min(...amounts),
                amountMax: Math.max(...amounts),
                isRecurring: false,
                recurrencePattern: null
            };

            // Check if recurring
            const recurrence = this.detectRecurringPattern(
                data.transactions[0],
                data.transactions
            );
            pattern.isRecurring = recurrence.isRecurring;
            pattern.recurrencePattern = recurrence.pattern;

            patterns.push(pattern);
        }

        // Update database with new patterns
        await this.updatePatternsInDatabase(patterns);

        this.patterns = await this.db.getPatterns();
        return patterns;
    }

    /**
     * Update patterns in database (merge with existing)
     */
    async updatePatternsInDatabase(newPatterns) {
        const existingPatterns = await this.db.getPatterns();

        for (const newPattern of newPatterns) {
            // Find existing pattern with same merchant and category
            const existing = existingPatterns.find(p =>
                p.merchantName === newPattern.merchantName &&
                p.categoryId === newPattern.categoryId
            );

            if (existing) {
                // Update existing pattern
                existing.matchCount = newPattern.matchCount;
                existing.lastSeen = newPattern.lastSeen;
                existing.amountMin = Math.min(existing.amountMin || Infinity, newPattern.amountMin);
                existing.amountMax = Math.max(existing.amountMax || 0, newPattern.amountMax);
                existing.isRecurring = newPattern.isRecurring;
                existing.recurrencePattern = newPattern.recurrencePattern;

                await this.db.updatePattern(existing);
            } else {
                // Add new pattern
                await this.db.addPattern(newPattern);
            }
        }
    }

    /**
     * Calculate confidence score for a category suggestion
     * Returns 0-100
     */
    calculateConfidence(transaction, pattern) {
        let confidence = 0;

        // Factor 1: Number of historical matches (0-40 points)
        const matchScore = Math.min(40, pattern.matchCount * 5);
        confidence += matchScore;

        // Factor 2: Merchant name similarity (0-30 points)
        const merchantName = this.normalizeMerchant(transaction.description);
        const similarityScore = this.calculateSimilarity(merchantName, pattern.merchantName);
        confidence += (similarityScore / 100) * 30;

        // Factor 3: Amount matching (0-20 points)
        const amount = Math.abs(transaction.amount);
        if (pattern.amountMin && pattern.amountMax) {
            const amountRange = pattern.amountMax - pattern.amountMin;
            const isExactMatch = Math.abs(amount - pattern.amountMin) < 0.01;
            const isInRange = amount >= pattern.amountMin && amount <= pattern.amountMax;
            const isCloseToRange = amount >= pattern.amountMin * 0.9 && amount <= pattern.amountMax * 1.1;

            if (isExactMatch) {
                confidence += 20;
            } else if (isInRange) {
                confidence += 15;
            } else if (isCloseToRange) {
                confidence += 10;
            }
        }

        // Factor 4: Recurring pattern (0-10 points)
        if (pattern.isRecurring) {
            confidence += 10;
        }

        // Factor 5: Accept/deny ratio (modifier: -20 to +10 points)
        const totalFeedback = pattern.acceptCount + pattern.denyCount;
        if (totalFeedback > 0) {
            const acceptRatio = pattern.acceptCount / totalFeedback;
            if (acceptRatio >= 0.9) {
                confidence += 10;
            } else if (acceptRatio < 0.5) {
                confidence -= 20;
            }
        }

        return Math.max(0, Math.min(100, confidence));
    }

    /**
     * Find best matching pattern for a transaction
     */
    findBestMatch(transaction) {
        const merchantName = this.normalizeMerchant(transaction.description);
        if (!merchantName) return null;

        let bestMatch = null;
        let bestConfidence = 0;

        for (const pattern of this.patterns) {
            const confidence = this.calculateConfidence(transaction, pattern);

            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestMatch = {
                    pattern,
                    confidence,
                    reasoning: this.generateReasoning(transaction, pattern, confidence)
                };
            }
        }

        // Only return if meets threshold
        if (bestMatch && bestConfidence >= this.confidenceThreshold) {
            return bestMatch;
        }

        return null;
    }

    /**
     * Generate human-readable reasoning for a suggestion
     */
    generateReasoning(transaction, pattern, confidence) {
        const parts = [];
        const merchantName = this.normalizeMerchant(transaction.description);

        // Merchant match
        const similarity = this.calculateSimilarity(merchantName, pattern.merchantName);
        if (similarity > 95) {
            parts.push(`Exact match with "${pattern.merchantName}"`);
        } else if (similarity > 70) {
            parts.push(`Similar to "${pattern.merchantName}"`);
        }

        // Historical matches
        if (pattern.matchCount === 1) {
            parts.push('1 similar transaction');
        } else if (pattern.matchCount > 1) {
            parts.push(`${pattern.matchCount} similar transactions`);
        }

        // Recurring
        if (pattern.isRecurring) {
            parts.push('recurring transaction');
        }

        // Amount
        const amount = Math.abs(transaction.amount);
        if (pattern.amountMin && Math.abs(amount - pattern.amountMin) < 0.01) {
            parts.push('exact amount match');
        }

        return parts.join(', ');
    }

    /**
     * Auto-categorize new transactions
     * Returns array of transactions with suggestions applied
     */
    async autoCategorize(transactions) {
        const results = {
            total: transactions.length,
            suggested: 0,
            noMatch: 0,
            transactions: []
        };

        for (const transaction of transactions) {
            // Skip already categorized or split transactions
            if (transaction.categoryId || transaction.isSplit) {
                continue;
            }

            const match = this.findBestMatch(transaction);

            if (match) {
                // Apply suggestion
                transaction.categoryId = match.pattern.categoryId;
                transaction.pendingReview = true;
                transaction.suggestionConfidence = match.confidence;
                transaction.suggestionReasoning = match.reasoning;
                transaction.suggestionPatternId = match.pattern.id;

                results.suggested++;
                results.transactions.push({
                    transaction,
                    match
                });
            } else {
                results.noMatch++;
            }
        }

        return results;
    }

    /**
     * Accept a suggestion (positive feedback)
     */
    async acceptSuggestion(transaction) {
        if (!transaction.suggestionPatternId) return;

        const pattern = this.patterns.find(p => p.id === transaction.suggestionPatternId);
        if (pattern) {
            pattern.acceptCount++;
            pattern.lastSeen = new Date().toISOString();
            await this.db.updatePattern(pattern);
        }

        // Remove pending review flags
        delete transaction.pendingReview;
        delete transaction.suggestionConfidence;
        delete transaction.suggestionReasoning;
        delete transaction.suggestionPatternId;

        await this.db.updateTransaction(transaction);
    }

    /**
     * Deny a suggestion (negative feedback)
     */
    async denySuggestion(transaction) {
        if (!transaction.suggestionPatternId) return;

        const pattern = this.patterns.find(p => p.id === transaction.suggestionPatternId);
        if (pattern) {
            pattern.denyCount++;
            await this.db.updatePattern(pattern);
        }

        // Remove category and pending review flags
        transaction.categoryId = null;
        delete transaction.pendingReview;
        delete transaction.suggestionConfidence;
        delete transaction.suggestionReasoning;
        delete transaction.suggestionPatternId;

        await this.db.updateTransaction(transaction);
    }

    /**
     * Get all pending review transactions
     */
    async getPendingReviewTransactions(allTransactions) {
        return allTransactions.filter(t => t.pendingReview === true);
    }

    /**
     * Accept all pending suggestions
     */
    async acceptAllPending(transactions) {
        const pending = transactions.filter(t => t.pendingReview);

        for (const transaction of pending) {
            await this.acceptSuggestion(transaction);
        }

        return pending.length;
    }

    /**
     * Set confidence threshold
     */
    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = Math.max(0, Math.min(100, threshold));
    }

    /**
     * Get confidence threshold
     */
    getConfidenceThreshold() {
        return this.confidenceThreshold;
    }
}
