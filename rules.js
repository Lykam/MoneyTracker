/**
 * Auto-Categorization Rules Engine for MoneyTracker
 */

class RulesEngine {
    constructor(db) {
        this.db = db;
        this.rules = [];
    }

    /**
     * Initialize rules from database
     */
    async init() {
        this.rules = await this.db.getAllRules();
        // Sort by priority (higher priority first)
        this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return this.rules;
    }

    /**
     * Create a new rule
     */
    async createRule(pattern, categoryId, matchField = 'both', priority = 0) {
        const rule = {
            pattern: pattern.toLowerCase().trim(),
            categoryId,
            matchField,
            priority,
            createdDate: new Date().toISOString()
        };

        const id = await this.db.addRule(rule);
        rule.id = id;
        this.rules.push(rule);

        // Re-sort rules
        this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        return rule;
    }

    /**
     * Update an existing rule
     */
    async updateRule(id, updates) {
        const rule = this.rules.find(r => r.id === id);
        if (!rule) throw new Error('Rule not found');

        Object.assign(rule, updates);
        await this.db.updateRule(rule);

        // Re-sort if priority changed
        if (updates.priority !== undefined) {
            this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        }

        return rule;
    }

    /**
     * Delete a rule
     */
    async deleteRule(id) {
        await this.db.deleteRule(id);
        this.rules = this.rules.filter(r => r.id !== id);
    }

    /**
     * Get all rules
     */
    getAllRules() {
        return this.rules;
    }

    /**
     * Get rules for a specific category
     */
    getRulesByCategory(categoryId) {
        return this.rules.filter(r => r.categoryId === categoryId);
    }

    /**
     * Find matching rule for a transaction
     */
    findMatchingRule(transaction) {
        for (const rule of this.rules) {
            if (this.testRule(rule, transaction)) {
                return rule;
            }
        }
        return null;
    }

    /**
     * Test if a rule matches a transaction
     */
    testRule(rule, transaction) {
        const pattern = rule.pattern.toLowerCase();
        const description = (transaction.description || '').toLowerCase();
        const memo = (transaction.memo || '').toLowerCase();

        switch (rule.matchField) {
            case 'description':
                return description.includes(pattern);
            case 'memo':
                return memo.includes(pattern);
            case 'both':
            default:
                return description.includes(pattern) || memo.includes(pattern);
        }
    }

    /**
     * Apply rules to a single transaction
     * @returns {Object|null} The matched rule or null
     */
    applyRulesToTransaction(transaction) {
        // Skip if already categorized
        if (transaction.categoryId) {
            return null;
        }

        const matchedRule = this.findMatchingRule(transaction);
        if (matchedRule) {
            transaction.categoryId = matchedRule.categoryId;
            return matchedRule;
        }

        return null;
    }

    /**
     * Apply rules to multiple transactions
     * @returns {Object} Statistics about the operation
     */
    applyRulesToTransactions(transactions) {
        let categorized = 0;
        const matchedRules = new Set();

        transactions.forEach(transaction => {
            const matchedRule = this.applyRulesToTransaction(transaction);
            if (matchedRule) {
                categorized++;
                matchedRules.add(matchedRule.id);
            }
        });

        return {
            categorized,
            rulesMatched: matchedRules.size,
            total: transactions.length
        };
    }

    /**
     * Suggest a rule based on a transaction
     * Extracts potential patterns from description
     */
    suggestRule(transaction) {
        const description = transaction.description || '';

        // Extract merchant name (remove trailing location/details)
        let pattern = description.trim();

        // Remove common suffixes
        pattern = pattern.replace(/\s+\d{3}-\d{3}-\d{4}.*$/i, ''); // Phone numbers
        pattern = pattern.replace(/\s+(CA|NY|TX|FL|GA|WA)\s*$/i, ''); // State codes
        pattern = pattern.replace(/\s+\d{5,}.*$/i, ''); // Long numbers/IDs

        // Take first significant part
        const parts = pattern.split(/\s{2,}|\t/);
        pattern = parts[0].trim();

        // Limit length
        if (pattern.length > 30) {
            pattern = pattern.substring(0, 30);
        }

        return pattern;
    }

    /**
     * Create a rule from a categorized transaction
     */
    async createRuleFromTransaction(transaction) {
        if (!transaction.categoryId) {
            throw new Error('Transaction must be categorized first');
        }

        const pattern = this.suggestRule(transaction);
        return await this.createRule(pattern, transaction.categoryId, 'both', 0);
    }

    /**
     * Get statistics about rule usage
     */
    async getRuleStatistics(transactions) {
        const stats = {};

        this.rules.forEach(rule => {
            stats[rule.id] = {
                rule,
                matches: 0,
                transactions: []
            };
        });

        transactions.forEach(transaction => {
            this.rules.forEach(rule => {
                if (this.testRule(rule, transaction)) {
                    stats[rule.id].matches++;
                    stats[rule.id].transactions.push(transaction.id);
                }
            });
        });

        return stats;
    }
}
