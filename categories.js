/**
 * Category Management for MoneyTracker
 */

class CategoryManager {
    constructor(db) {
        this.db = db;
        this.categories = [];
        this.defaultColors = [
            '#4a9eff', '#f44336', '#4caf50', '#ff9800',
            '#9c27b0', '#00bcd4', '#ffeb3b', '#e91e63',
            '#3f51b5', '#009688', '#ff5722', '#795548'
        ];
        this.colorIndex = 0;
    }

    /**
     * Initialize with default categories
     */
    async init() {
        this.categories = await this.db.getAllCategories();

        // Create default categories if none exist
        if (this.categories.length === 0) {
            await this.createDefaultCategories();
            this.categories = await this.db.getAllCategories();
        } else {
            // Migration: Add Transfers categories if they don't exist
            const hasTransfers = this.categories.some(c => c.parent === 'Transfers');
            if (!hasTransfers) {
                await this.addTransfersCategories();
                this.categories = await this.db.getAllCategories();
            }

            // Migration: Add Clothing and Household Supplies if they don't exist
            const hasClothing = this.categories.some(c => c.name === 'Clothing' && c.parent === 'Shared');
            const hasHouseholdSupplies = this.categories.some(c => c.name === 'Household Supplies' && c.parent === 'Shared');
            if (!hasClothing || !hasHouseholdSupplies) {
                await this.addSharedCategories();
                this.categories = await this.db.getAllCategories();
            }
        }

        return this.categories;
    }

    /**
     * Add Transfers categories (for migration)
     */
    async addTransfersCategories() {
        const transfersCategories = [
            { name: 'Credit Card Payment', parent: 'Transfers', color: '#9e9e9e' },
            { name: 'Savings Transfer', parent: 'Transfers', color: '#757575' },
            { name: 'Account Transfer', parent: 'Transfers', color: '#616161' }
        ];

        for (const category of transfersCategories) {
            await this.db.addCategory(category);
        }
    }

    /**
     * Add Shared categories (for migration)
     */
    async addSharedCategories() {
        const sharedCategories = [
            { name: 'Clothing', parent: 'Shared', color: '#9c27b0' },
            { name: 'Household Supplies', parent: 'Shared', color: '#607d8b' }
        ];

        for (const category of sharedCategories) {
            const exists = this.categories.some(c => c.name === category.name && c.parent === category.parent);
            if (!exists) {
                await this.db.addCategory(category);
            }
        }
    }

    /**
     * Create default category structure
     */
    async createDefaultCategories() {
        const defaults = [
            // His categories
            { name: 'Personal Spending', parent: 'His', color: '#4a9eff' },
            { name: 'Hobbies', parent: 'His', color: '#3f51b5' },

            // Hers categories
            { name: 'Personal Spending', parent: 'Hers', color: '#e91e63' },
            { name: 'Hobbies', parent: 'Hers', color: '#9c27b0' },

            // Pets categories
            { name: 'Food', parent: 'Pets', color: '#4caf50' },
            { name: 'Vet', parent: 'Pets', color: '#00bcd4' },
            { name: 'Supplies', parent: 'Pets', color: '#009688' },

            // Shared categories
            { name: 'Groceries', parent: 'Shared', color: '#4caf50' },
            { name: 'Dining Out', parent: 'Shared', color: '#ff9800' },
            { name: 'Utilities', parent: 'Shared', color: '#795548' },
            { name: 'Rent/Mortgage', parent: 'Shared', color: '#f44336' },
            { name: 'Transportation', parent: 'Shared', color: '#00bcd4' },
            { name: 'Entertainment', parent: 'Shared', color: '#ffeb3b' },
            { name: 'Healthcare', parent: 'Shared', color: '#ff5722' },
            { name: 'Clothing', parent: 'Shared', color: '#9c27b0' },
            { name: 'Household Supplies', parent: 'Shared', color: '#607d8b' },

            // Transfers categories
            { name: 'Credit Card Payment', parent: 'Transfers', color: '#9e9e9e' },
            { name: 'Savings Transfer', parent: 'Transfers', color: '#757575' },
            { name: 'Account Transfer', parent: 'Transfers', color: '#616161' }
        ];

        for (const category of defaults) {
            await this.db.addCategory(category);
        }
    }

    /**
     * Add a new category
     */
    async addCategory(name, parent) {
        const color = this.getNextColor();
        const category = { name, parent, color };

        const id = await this.db.addCategory(category);
        category.id = id;
        this.categories.push(category);

        return category;
    }

    /**
     * Update a category
     */
    async updateCategory(id, updates) {
        const category = this.categories.find(c => c.id === id);
        if (!category) throw new Error('Category not found');

        Object.assign(category, updates);
        await this.db.updateCategory(category);

        return category;
    }

    /**
     * Delete a category
     */
    async deleteCategory(id) {
        await this.db.deleteCategory(id);
        this.categories = this.categories.filter(c => c.id !== id);

        // TODO: Handle transactions with this category (set to null or reassign)
    }

    /**
     * Get categories by parent group
     */
    getCategoriesByGroup(parent) {
        return this.categories.filter(c => c.parent === parent);
    }

    /**
     * Get category by ID
     */
    getCategoryById(id) {
        return this.categories.find(c => c.id === id);
    }

    /**
     * Get all categories as a flat list
     */
    getAllCategories() {
        return this.categories;
    }

    /**
     * Get grouped categories for display
     */
    getGroupedCategories() {
        return {
            His: this.getCategoriesByGroup('His'),
            Hers: this.getCategoriesByGroup('Hers'),
            Pets: this.getCategoriesByGroup('Pets'),
            Shared: this.getCategoriesByGroup('Shared'),
            Transfers: this.getCategoriesByGroup('Transfers')
        };
    }

    /**
     * Get next color from palette
     */
    getNextColor() {
        const color = this.defaultColors[this.colorIndex];
        this.colorIndex = (this.colorIndex + 1) % this.defaultColors.length;
        return color;
    }

    /**
     * Count transactions per category
     */
    async getCategoryCounts(transactions) {
        const counts = {};

        // Initialize counts
        this.categories.forEach(cat => {
            counts[cat.id] = 0;
        });
        counts['uncategorized'] = 0;

        // Count transactions
        transactions.forEach(txn => {
            if (txn.isSplit && txn.splits && txn.splits.length > 0) {
                // For split transactions, count each split
                txn.splits.forEach(split => {
                    if (split.categoryId) {
                        counts[split.categoryId] = (counts[split.categoryId] || 0) + 1;
                    }
                });
            } else if (txn.categoryId) {
                counts[txn.categoryId] = (counts[txn.categoryId] || 0) + 1;
            } else {
                counts['uncategorized']++;
            }
        });

        return counts;
    }

    /**
     * Get total spending per category
     */
    async getCategoryTotals(transactions) {
        const totals = {};

        // Initialize totals
        this.categories.forEach(cat => {
            totals[cat.id] = 0;
        });
        totals['uncategorized'] = 0;

        // Sum amounts
        transactions.forEach(txn => {
            if (txn.categoryId) {
                totals[txn.categoryId] = (totals[txn.categoryId] || 0) + txn.amount;
            } else {
                totals['uncategorized'] += txn.amount;
            }
        });

        return totals;
    }
}
