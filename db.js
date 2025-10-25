/**
 * IndexedDB Wrapper for MoneyTracker
 * Manages all data persistence
 */

class MoneyTrackerDB {
    constructor() {
        this.dbName = 'MoneyTrackerDB_v2';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            console.log('Opening IndexedDB:', this.dbName, 'version:', this.version);
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log('IndexedDB opened successfully');
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('IndexedDB upgrade needed, old version:', event.oldVersion, 'new version:', event.newVersion);
                const db = event.target.result;

                // Create transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('categoryId', 'categoryId', { unique: false });
                    transactionStore.createIndex('amount', 'amount', { unique: false });
                    transactionStore.createIndex('hash', 'hash', { unique: false });
                }

                // Create categories store
                if (!db.objectStoreNames.contains('categories')) {
                    const categoryStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                    categoryStore.createIndex('parent', 'parent', { unique: false });
                }

                // Create rules store
                if (!db.objectStoreNames.contains('rules')) {
                    const ruleStore = db.createObjectStore('rules', { keyPath: 'id', autoIncrement: true });
                    ruleStore.createIndex('categoryId', 'categoryId', { unique: false });
                    ruleStore.createIndex('priority', 'priority', { unique: false });
                }

                // Create templates store (v2)
                if (!db.objectStoreNames.contains('templates')) {
                    console.log('Creating templates store...');
                    const templateStore = db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true });
                    templateStore.createIndex('name', 'name', { unique: false });
                    templateStore.createIndex('merchant', 'merchant', { unique: false });
                }

                console.log('IndexedDB upgrade completed');
            };
        });
    }

    /**
     * Add a transaction
     */
    async addTransaction(transaction) {
        const tx = this.db.transaction(['transactions'], 'readwrite');
        const store = tx.objectStore('transactions');

        // Generate hash for deduplication
        transaction.hash = CSVParser.generateHash(transaction);

        return new Promise((resolve, reject) => {
            const request = store.add(transaction);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add multiple transactions
     */
    async addTransactions(transactions) {
        const tx = this.db.transaction(['transactions'], 'readwrite');
        const store = tx.objectStore('transactions');
        const hashIndex = store.index('hash');

        const results = [];
        const duplicates = [];

        for (const transaction of transactions) {
            transaction.hash = CSVParser.generateHash(transaction);

            // Check for duplicates
            const existingCount = await new Promise((resolve, reject) => {
                const countRequest = hashIndex.count(transaction.hash);
                countRequest.onsuccess = () => resolve(countRequest.result);
                countRequest.onerror = () => reject(countRequest.error);
            });

            if (existingCount > 0) {
                duplicates.push(transaction);
            } else {
                await new Promise((resolve, reject) => {
                    const request = store.add(transaction);
                    request.onsuccess = () => {
                        results.push(request.result);
                        resolve();
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        }

        return { added: results.length, duplicates: duplicates.length };
    }

    /**
     * Get all transactions
     */
    async getAllTransactions() {
        const tx = this.db.transaction(['transactions'], 'readonly');
        const store = tx.objectStore('transactions');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get transactions by category
     */
    async getTransactionsByCategory(categoryId) {
        const tx = this.db.transaction(['transactions'], 'readonly');
        const store = tx.objectStore('transactions');
        const index = store.index('categoryId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(categoryId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a transaction
     */
    async updateTransaction(transaction) {
        const tx = this.db.transaction(['transactions'], 'readwrite');
        const store = tx.objectStore('transactions');

        return new Promise((resolve, reject) => {
            const request = store.put(transaction);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a transaction
     */
    async deleteTransaction(id) {
        const tx = this.db.transaction(['transactions'], 'readwrite');
        const store = tx.objectStore('transactions');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add a category
     */
    async addCategory(category) {
        const tx = this.db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.add(category);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all categories
     */
    async getAllCategories() {
        const tx = this.db.transaction(['categories'], 'readonly');
        const store = tx.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a category
     */
    async updateCategory(category) {
        const tx = this.db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.put(category);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a category
     */
    async deleteCategory(id) {
        const tx = this.db.transaction(['categories'], 'readwrite');
        const store = tx.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add a rule
     */
    async addRule(rule) {
        const tx = this.db.transaction(['rules'], 'readwrite');
        const store = tx.objectStore('rules');

        return new Promise((resolve, reject) => {
            const request = store.add(rule);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all rules
     */
    async getAllRules() {
        const tx = this.db.transaction(['rules'], 'readonly');
        const store = tx.objectStore('rules');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a rule
     */
    async updateRule(rule) {
        const tx = this.db.transaction(['rules'], 'readwrite');
        const store = tx.objectStore('rules');

        return new Promise((resolve, reject) => {
            const request = store.put(rule);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a rule
     */
    async deleteRule(id) {
        const tx = this.db.transaction(['rules'], 'readwrite');
        const store = tx.objectStore('rules');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add a template
     */
    async addTemplate(template) {
        const tx = this.db.transaction(['templates'], 'readwrite');
        const store = tx.objectStore('templates');

        return new Promise((resolve, reject) => {
            const request = store.add(template);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all templates
     */
    async getAllTemplates() {
        const tx = this.db.transaction(['templates'], 'readonly');
        const store = tx.objectStore('templates');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a template
     */
    async updateTemplate(template) {
        const tx = this.db.transaction(['templates'], 'readwrite');
        const store = tx.objectStore('templates');

        return new Promise((resolve, reject) => {
            const request = store.put(template);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a template
     */
    async deleteTemplate(id) {
        const tx = this.db.transaction(['templates'], 'readwrite');
        const store = tx.objectStore('templates');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export all data
     */
    async exportData() {
        const transactions = await this.getAllTransactions();
        const categories = await this.getAllCategories();
        const rules = await this.getAllRules();
        const templates = await this.getAllTemplates();

        return {
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            data: {
                transactions,
                categories,
                rules,
                templates
            }
        };
    }

    /**
     * Import data (replaces existing data)
     */
    async importData(exportData) {
        // Clear existing data
        await this.clearAllData();

        // Import transactions
        for (const transaction of exportData.data.transactions) {
            await this.addTransaction(transaction);
        }

        // Import categories
        for (const category of exportData.data.categories) {
            await this.addCategory(category);
        }

        // Import rules
        for (const rule of exportData.data.rules) {
            await this.addRule(rule);
        }

        // Import templates (if they exist)
        if (exportData.data.templates) {
            for (const template of exportData.data.templates) {
                await this.addTemplate(template);
            }
        }

        return {
            transactions: exportData.data.transactions.length,
            categories: exportData.data.categories.length,
            rules: exportData.data.rules.length,
            templates: exportData.data.templates ? exportData.data.templates.length : 0
        };
    }

    /**
     * Clear all data from all stores
     */
    async clearAllData() {
        const tx = this.db.transaction(['transactions', 'categories', 'rules', 'templates'], 'readwrite');

        await Promise.all([
            new Promise((resolve, reject) => {
                const request = tx.objectStore('transactions').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = tx.objectStore('categories').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = tx.objectStore('rules').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = tx.objectStore('templates').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    }
}
