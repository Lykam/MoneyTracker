/**
 * Template Manager for MoneyTracker
 * Manages split transaction templates
 */

class TemplateManager {
    constructor(db, categoryManager) {
        this.db = db;
        this.categoryManager = categoryManager;
        this.templates = [];
    }

    /**
     * Initialize with default templates
     */
    async init() {
        this.templates = await this.db.getAllTemplates();

        // Create default templates if none exist
        if (this.templates.length === 0) {
            await this.createDefaultTemplates();
            this.templates = await this.db.getAllTemplates();
        } else {
            // Update existing default templates to match current definitions
            await this.updateDefaultTemplates();
            this.templates = await this.db.getAllTemplates();
        }

        return this.templates;
    }

    /**
     * Update existing default templates to match current definitions
     */
    async updateDefaultTemplates() {
        // Get category IDs by name
        const getCategoryId = (name, parent) => {
            const category = this.categoryManager.categories.find(
                c => c.name === name && c.parent === parent
            );
            return category ? category.id : null;
        };

        const defaultDefinitions = {
            'Walmart - Typical': {
                merchant: 'WALMART',
                splits: [
                    { categoryId: getCategoryId('Groceries', 'Shared'), percentage: 60 },
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 30 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 10 }
                ]
            },
            'Target - Typical': {
                merchant: 'TARGET',
                splits: [
                    { categoryId: getCategoryId('Groceries', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Clothing', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Entertainment', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 10 }
                ]
            },
            'Amazon - Typical': {
                merchant: 'AMAZON',
                splits: [
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 35 },
                    { categoryId: getCategoryId('Clothing', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Entertainment', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 20 }
                ]
            }
        };

        // Update each default template if it exists
        for (const [name, definition] of Object.entries(defaultDefinitions)) {
            const existingTemplate = this.templates.find(t => t.name === name && t.isDefault);
            if (existingTemplate) {
                // Filter out any splits with null categoryIds
                const validSplits = definition.splits.filter(split => split.categoryId !== null);

                // Update the template
                existingTemplate.splits = validSplits;
                existingTemplate.merchant = definition.merchant;
                await this.db.updateTemplate(existingTemplate);
            }
        }
    }

    /**
     * Create default store templates
     */
    async createDefaultTemplates() {
        // Get category IDs by name
        const getCategoryId = (name, parent) => {
            const category = this.categoryManager.categories.find(
                c => c.name === name && c.parent === parent
            );
            return category ? category.id : null;
        };

        const defaults = [
            {
                name: 'Walmart - Typical',
                merchant: 'WALMART',
                splits: [
                    { categoryId: getCategoryId('Groceries', 'Shared'), percentage: 60 },
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 30 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 10 }
                ],
                isDefault: true,
                createdDate: new Date().toISOString()
            },
            {
                name: 'Target - Typical',
                merchant: 'TARGET',
                splits: [
                    { categoryId: getCategoryId('Groceries', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Clothing', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Entertainment', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 10 }
                ],
                isDefault: true,
                createdDate: new Date().toISOString()
            },
            {
                name: 'Amazon - Typical',
                merchant: 'AMAZON',
                splits: [
                    { categoryId: getCategoryId('Household Supplies', 'Shared'), percentage: 35 },
                    { categoryId: getCategoryId('Clothing', 'Shared'), percentage: 25 },
                    { categoryId: getCategoryId('Entertainment', 'Shared'), percentage: 20 },
                    { categoryId: getCategoryId('Supplies', 'Pets'), percentage: 20 }
                ],
                isDefault: true,
                createdDate: new Date().toISOString()
            }
        ];

        // Filter out any splits with null categoryIds (in case categories don't exist)
        defaults.forEach(template => {
            template.splits = template.splits.filter(split => split.categoryId !== null);
        });

        for (const template of defaults) {
            if (template.splits.length > 0) {
                await this.db.addTemplate(template);
            }
        }
    }

    /**
     * Create a new template
     */
    async createTemplate(name, merchant, splits, isDefault = false) {
        const template = {
            name,
            merchant: merchant ? merchant.toUpperCase() : null,
            splits,
            isDefault,
            createdDate: new Date().toISOString()
        };

        const id = await this.db.addTemplate(template);
        template.id = id;
        this.templates.push(template);

        return template;
    }

    /**
     * Update a template
     */
    async updateTemplate(id, updates) {
        const template = this.templates.find(t => t.id === id);
        if (!template) throw new Error('Template not found');

        Object.assign(template, updates);
        await this.db.updateTemplate(template);

        return template;
    }

    /**
     * Delete a template
     */
    async deleteTemplate(id) {
        await this.db.deleteTemplate(id);
        this.templates = this.templates.filter(t => t.id !== id);
    }

    /**
     * Get all templates
     */
    getAllTemplates() {
        return this.templates;
    }

    /**
     * Get template by ID
     */
    getTemplateById(id) {
        return this.templates.find(t => t.id === id);
    }

    /**
     * Suggest templates for a transaction description
     */
    suggestTemplatesForTransaction(description) {
        if (!description) return [];

        const descUpper = description.toUpperCase();

        return this.templates.filter(template => {
            if (!template.merchant) return false;
            return descUpper.includes(template.merchant);
        });
    }

    /**
     * Apply a template to a transaction
     * Returns an array of split objects with amounts calculated
     */
    applyTemplate(templateId, transactionAmount) {
        const template = this.getTemplateById(templateId);
        if (!template) throw new Error('Template not found');

        const totalAmount = Math.abs(transactionAmount);
        const isNegative = transactionAmount < 0;

        const splits = template.splits.map(split => {
            const amount = (totalAmount * split.percentage / 100);
            return {
                categoryId: split.categoryId,
                percentage: split.percentage,
                amount: isNegative ? -amount : amount
            };
        });

        // Handle rounding errors - adjust last split to match total exactly
        const calculatedTotal = Math.abs(splits.reduce((sum, split) => sum + split.amount, 0));
        const difference = totalAmount - calculatedTotal;

        if (Math.abs(difference) > 0.01 && splits.length > 0) {
            const lastSplit = splits[splits.length - 1];
            lastSplit.amount += isNegative ? -difference : difference;
        }

        return splits;
    }

    /**
     * Validate that split percentages add up to 100%
     */
    validateSplits(splits) {
        const total = splits.reduce((sum, split) => sum + split.percentage, 0);
        return Math.abs(total - 100) < 0.01; // Allow for floating point errors
    }

    /**
     * Create a template from a transaction's splits
     */
    async createTemplateFromTransaction(name, transaction) {
        if (!transaction.splits || transaction.splits.length === 0) {
            throw new Error('Transaction has no splits');
        }

        const splits = transaction.splits.map(split => ({
            categoryId: split.categoryId,
            percentage: split.percentage
        }));

        // Extract merchant from description
        const merchant = this.extractMerchant(transaction.description);

        return await this.createTemplate(name, merchant, splits, false);
    }

    /**
     * Extract merchant name from transaction description
     */
    extractMerchant(description) {
        if (!description) return null;

        // Common patterns
        const patterns = [
            /^(WALMART|TARGET|AMAZON|COSTCO|KROGER|PUBLIX|SAFEWAY)/i,
            /^([A-Z\s]+?)(?:\s+\d|\s+#|\s+-)/,  // Match until number or special char
        ];

        for (const pattern of patterns) {
            const match = description.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        // Fallback: take first 20 chars
        return description.substring(0, 20).trim();
    }
}
