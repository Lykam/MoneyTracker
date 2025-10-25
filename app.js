/**
 * MoneyTracker Main Application
 */

class MoneyTrackerApp {
    constructor() {
        this.db = new MoneyTrackerDB();
        this.categoryManager = null;
        this.rulesEngine = null;
        this.templateManager = null;
        this.transactions = [];
        this.selectedTransactions = new Set();
        this.categoryCounts = {};
        this.previewTransactions = [];
        this.currentSplitTransaction = null;
        this.currentSplits = [];
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize database
            await this.db.init();

            // Initialize category manager
            this.categoryManager = new CategoryManager(this.db);
            await this.categoryManager.init();

            // Initialize rules engine
            this.rulesEngine = new RulesEngine(this.db);
            await this.rulesEngine.init();

            // Initialize template manager
            this.templateManager = new TemplateManager(this.db, this.categoryManager);
            await this.templateManager.init();

            // Load transactions
            await this.loadTransactions();

            // Setup UI
            this.setupEventListeners();
            this.renderCategories();
            this.renderTransactions();

            console.log('MoneyTracker initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            alert('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Import CSV
        document.getElementById('importBtn').addEventListener('click', () => this.openImportModal());
        document.getElementById('csvFileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('confirmImportBtn').addEventListener('click', () => this.confirmImport());
        document.getElementById('cancelImportBtn').addEventListener('click', () => this.closeImportModal());

        // Export data
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // Category manager
        document.getElementById('categoryManagerBtn').addEventListener('click', () => this.openCategoryManager());
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addCategory());

        // Bulk categorize
        document.getElementById('bulkCategorizeBtn').addEventListener('click', () => this.openBulkCategorize());
        document.getElementById('confirmBulkCategorizeBtn').addEventListener('click', () => this.confirmBulkCategorize());
        document.getElementById('cancelBulkCategorizeBtn').addEventListener('click', () => this.closeBulkCategorize());

        // Split transaction
        document.getElementById('addSplitBtn').addEventListener('click', () => this.addSplitRow());
        document.getElementById('confirmSplitBtn').addEventListener('click', () => this.confirmSplit());
        document.getElementById('cancelSplitBtn').addEventListener('click', () => this.closeSplitModal());
        document.getElementById('saveSplitAsTemplateBtn').addEventListener('click', () => this.openSaveSplitTemplate());
        document.getElementById('confirmSaveTemplateBtn').addEventListener('click', () => this.confirmSaveSplitTemplate());
        document.getElementById('cancelSaveTemplateBtn').addEventListener('click', () => this.closeSaveSplitTemplate());

        // Apply rules
        document.getElementById('applyRulesBtn').addEventListener('click', () => this.applyRules());

        // Clear selection
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());

        // Select all
        document.getElementById('selectAllCheckbox').addEventListener('change', (e) => this.selectAll(e.target.checked));

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchTransactions(e.target.value));

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });
    }

    /**
     * Load all transactions from database
     */
    async loadTransactions() {
        this.transactions = await this.db.getAllTransactions();
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        await this.updateCategoryCounts();
    }

    /**
     * Update category counts
     */
    async updateCategoryCounts() {
        this.categoryCounts = await this.categoryManager.getCategoryCounts(this.transactions);
    }

    /**
     * Render categories in sidebar
     */
    renderCategories() {
        const groups = this.categoryManager.getGroupedCategories();

        Object.keys(groups).forEach(groupName => {
            const container = document.querySelector(`.category-items[data-group="${groupName}"]`);
            if (!container) return;

            container.innerHTML = '';
            groups[groupName].forEach(category => {
                const count = this.categoryCounts[category.id] || 0;
                const item = this.createCategoryItem(category, count);
                container.appendChild(item);
            });
        });

        // Update uncategorized count
        const uncategorizedCount = this.categoryCounts['uncategorized'] || 0;
        document.getElementById('uncategorizedCount').textContent = uncategorizedCount;
    }

    /**
     * Create a category item element
     */
    createCategoryItem(category, count) {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <span class="category-name">
                <span class="category-color-dot" style="background-color: ${category.color}"></span>
                ${category.name}
            </span>
            <span class="category-count">${count}</span>
        `;

        item.addEventListener('click', () => this.filterByCategory(category.id));

        return item;
    }

    /**
     * Render transactions table
     */
    renderTransactions(filteredTransactions = null) {
        const tbody = document.getElementById('transactionTableBody');
        const transactionsToRender = filteredTransactions || this.transactions;

        if (transactionsToRender.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="6">
                        <div class="empty-message">
                            <p>No transactions found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        transactionsToRender.forEach(transaction => {
            const row = this.createTransactionRow(transaction);
            tbody.appendChild(row);
        });
    }

    /**
     * Create a transaction row element
     */
    createTransactionRow(transaction) {
        const row = document.createElement('tr');
        row.dataset.id = transaction.id;

        if (this.selectedTransactions.has(transaction.id)) {
            row.classList.add('selected');
        }

        const category = transaction.categoryId
            ? this.categoryManager.getCategoryById(transaction.categoryId)
            : null;

        const amountClass = transaction.amount < 0 ? 'amount-debit' : 'amount-credit';

        // Build category display
        let categoryDisplay = '';
        if (transaction.isSplit && transaction.splits && transaction.splits.length > 0) {
            categoryDisplay = `<span class="text-muted">Split (${transaction.splits.length} categories)</span>`;
        } else {
            categoryDisplay = `
                <select class="form-select category-select" data-transaction-id="${transaction.id}">
                    <option value="">Select category...</option>
                    ${this.renderCategoryOptions(transaction.categoryId)}
                </select>
            `;
        }

        row.innerHTML = `
            <td class="col-checkbox">
                <input type="checkbox" ${this.selectedTransactions.has(transaction.id) ? 'checked' : ''}>
            </td>
            <td class="col-date">${CSVParser.formatDate(transaction.date)}</td>
            <td class="col-description">
                ${transaction.description}
                ${transaction.memo ? `<br><small class="text-muted">${transaction.memo}</small>` : ''}
                ${transaction.isSplit ? '<br><span class="text-success" style="font-size: 0.8rem;">✓ Split</span>' : ''}
            </td>
            <td class="col-amount ${amountClass}">${CSVParser.formatAmount(transaction.amount)}</td>
            <td class="col-category">
                ${categoryDisplay}
            </td>
            <td class="col-actions">
                <button class="btn btn-small split-btn" data-transaction-id="${transaction.id}">${transaction.isSplit ? 'Edit Split' : 'Split'}</button>
            </td>
        `;

        // Checkbox event
        row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
            this.toggleTransactionSelection(transaction.id, e.target.checked);
        });

        // Category select event (only if not split)
        if (!transaction.isSplit) {
            row.querySelector('.category-select').addEventListener('change', (e) => {
                this.categorizeTransaction(transaction.id, e.target.value);
            });
        }

        // Split button event
        row.querySelector('.split-btn').addEventListener('click', () => {
            this.openSplitTransaction(transaction);
        });

        return row;
    }

    /**
     * Render category options for dropdown
     */
    renderCategoryOptions(selectedCategoryId) {
        const groups = this.categoryManager.getGroupedCategories();
        let html = '';

        Object.keys(groups).forEach(groupName => {
            html += `<optgroup label="${groupName}">`;
            groups[groupName].forEach(category => {
                const selected = category.id === selectedCategoryId ? 'selected' : '';
                html += `<option value="${category.id}" ${selected}>${category.name}</option>`;
            });
            html += '</optgroup>';
        });

        return html;
    }

    /**
     * Toggle transaction selection
     */
    toggleTransactionSelection(id, selected) {
        if (selected) {
            this.selectedTransactions.add(id);
        } else {
            this.selectedTransactions.delete(id);
        }

        this.updateSelectionUI();
    }

    /**
     * Update selection UI
     */
    updateSelectionUI() {
        const count = this.selectedTransactions.size;
        document.getElementById('selectionCount').textContent = `${count} selected`;
        document.getElementById('bulkCategorizeBtn').disabled = count === 0;

        // Update row styling
        document.querySelectorAll('#transactionTableBody tr').forEach(row => {
            const id = parseInt(row.dataset.id);
            if (this.selectedTransactions.has(id)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    /**
     * Select all transactions
     */
    selectAll(checked) {
        if (checked) {
            this.transactions.forEach(t => this.selectedTransactions.add(t.id));
        } else {
            this.selectedTransactions.clear();
        }

        this.renderTransactions();
        this.updateSelectionUI();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedTransactions.clear();
        document.getElementById('selectAllCheckbox').checked = false;
        this.updateSelectionUI();
        this.renderTransactions();
    }

    /**
     * Categorize a single transaction
     */
    async categorizeTransaction(id, categoryId) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) return;

        transaction.categoryId = categoryId ? parseInt(categoryId) : null;
        await this.db.updateTransaction(transaction);
        await this.updateCategoryCounts();
        this.renderCategories();
    }

    /**
     * Open import modal
     */
    openImportModal() {
        document.getElementById('importModal').classList.remove('hidden');
        document.getElementById('importStep1').classList.remove('hidden');
        document.getElementById('importStep2').classList.add('hidden');
    }

    /**
     * Close import modal
     */
    closeImportModal() {
        document.getElementById('importModal').classList.add('hidden');
        document.getElementById('csvFileInput').value = '';
        this.previewTransactions = [];
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const result = CSVParser.parse(text);

            this.previewTransactions = result.transactions;

            // Show preview
            this.showImportPreview(result);
        } catch (error) {
            alert('Error parsing CSV: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Show import preview
     */
    showImportPreview(result) {
        document.getElementById('importStep1').classList.add('hidden');
        document.getElementById('importStep2').classList.remove('hidden');

        document.getElementById('importInfo').textContent =
            `Found ${result.transactions.length} transactions (Format: ${result.format})`;

        // Show preview table (first 10 rows)
        const preview = result.transactions.slice(0, 10);
        const thead = document.getElementById('previewTableHead');
        const tbody = document.getElementById('previewTableBody');

        thead.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
            </tr>
        `;

        tbody.innerHTML = '';
        preview.forEach(txn => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${CSVParser.formatDate(txn.date)}</td>
                <td>${txn.description}</td>
                <td class="${txn.amount < 0 ? 'amount-debit' : 'amount-credit'}">
                    ${CSVParser.formatAmount(txn.amount)}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Confirm import
     */
    async confirmImport() {
        try {
            const result = await this.db.addTransactions(this.previewTransactions);

            await this.loadTransactions();
            this.renderCategories();
            this.renderTransactions();

            this.closeImportModal();

            alert(`Import complete!\nAdded: ${result.added}\nDuplicates skipped: ${result.duplicates}`);

            // Auto-apply rules if any exist
            if (this.rulesEngine.getAllRules().length > 0) {
                const shouldApply = confirm('Apply auto-categorization rules to new transactions?');
                if (shouldApply) {
                    await this.applyRules();
                }
            }
        } catch (error) {
            alert('Error importing transactions: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Open bulk categorize modal
     */
    openBulkCategorize() {
        if (this.selectedTransactions.size === 0) return;

        document.getElementById('bulkCategorizeModal').classList.remove('hidden');
        document.getElementById('bulkCategorizeInfo').textContent =
            `Categorize ${this.selectedTransactions.size} selected transactions`;

        // Populate category dropdown
        const select = document.getElementById('bulkCategorySelect');
        select.innerHTML = '<option value="">Select a category...</option>';
        select.innerHTML += this.renderCategoryOptions(null);
    }

    /**
     * Close bulk categorize modal
     */
    closeBulkCategorize() {
        document.getElementById('bulkCategorizeModal').classList.add('hidden');
    }

    /**
     * Confirm bulk categorize
     */
    async confirmBulkCategorize() {
        const categoryId = document.getElementById('bulkCategorySelect').value;
        if (!categoryId) {
            alert('Please select a category');
            return;
        }

        try {
            for (const id of this.selectedTransactions) {
                await this.categorizeTransaction(id, categoryId);
            }

            this.clearSelection();
            this.renderTransactions();
            this.closeBulkCategorize();

            alert(`Categorized ${this.selectedTransactions.size} transactions`);
        } catch (error) {
            alert('Error categorizing transactions: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Open create rule modal
     */
    openCreateRule(transaction) {
        if (!transaction.categoryId) {
            alert('Please categorize this transaction first before creating a rule');
            return;
        }

        document.getElementById('createRuleModal').classList.remove('hidden');

        // Suggest pattern
        const suggestedPattern = this.rulesEngine.suggestRule(transaction);
        document.getElementById('rulePatternInput').value = suggestedPattern;

        // Populate category dropdown
        const select = document.getElementById('ruleCategorySelect');
        select.innerHTML = this.renderCategoryOptions(transaction.categoryId);

        // Store transaction ID for later
        document.getElementById('createRuleModal').dataset.transactionId = transaction.id;
    }

    /**
     * Close create rule modal
     */
    closeCreateRuleModal() {
        document.getElementById('createRuleModal').classList.add('hidden');
    }

    /**
     * Confirm create rule
     */
    async confirmCreateRule() {
        const pattern = document.getElementById('rulePatternInput').value.trim();
        const categoryId = parseInt(document.getElementById('ruleCategorySelect').value);

        if (!pattern) {
            alert('Please enter a pattern');
            return;
        }

        if (!categoryId) {
            alert('Please select a category');
            return;
        }

        try {
            await this.rulesEngine.createRule(pattern, categoryId, 'both', 0);
            this.closeCreateRuleModal();
            alert('Rule created successfully!');
        } catch (error) {
            alert('Error creating rule: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Apply auto-categorization rules
     */
    async applyRules() {
        try {
            // Get uncategorized transactions
            const uncategorized = this.transactions.filter(t => !t.categoryId);

            if (uncategorized.length === 0) {
                alert('No uncategorized transactions found');
                return;
            }

            const result = this.rulesEngine.applyRulesToTransactions(uncategorized);

            // Update database
            for (const transaction of uncategorized) {
                if (transaction.categoryId) {
                    await this.db.updateTransaction(transaction);
                }
            }

            await this.updateCategoryCounts();
            this.renderCategories();
            this.renderTransactions();

            alert(`Auto-categorization complete!\nCategorized: ${result.categorized} of ${result.total} transactions`);
        } catch (error) {
            alert('Error applying rules: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Filter transactions by category
     */
    filterByCategory(categoryId) {
        const filtered = this.transactions.filter(t => t.categoryId === categoryId);
        this.renderTransactions(filtered);
    }

    /**
     * Search transactions
     */
    searchTransactions(query) {
        if (!query.trim()) {
            this.renderTransactions();
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = this.transactions.filter(t =>
            t.description.toLowerCase().includes(lowerQuery) ||
            (t.memo && t.memo.toLowerCase().includes(lowerQuery))
        );

        this.renderTransactions(filtered);
    }

    /**
     * Export data
     */
    async exportData() {
        try {
            const data = await this.db.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `moneytracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            alert('Error exporting data: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Open category manager modal
     */
    openCategoryManager() {
        document.getElementById('categoryManagerModal').classList.remove('hidden');
        this.renderCategoryManagerList();
    }

    /**
     * Close category manager modal
     */
    closeCategoryManager() {
        document.getElementById('categoryManagerModal').classList.add('hidden');
    }

    /**
     * Render category manager list
     */
    renderCategoryManagerList() {
        const container = document.getElementById('categoryManagerList');
        const groups = this.categoryManager.getGroupedCategories();

        container.innerHTML = '';

        Object.keys(groups).forEach(groupName => {
            const groupDiv = document.createElement('div');
            groupDiv.innerHTML = `<h4>${groupName}</h4>`;

            groups[groupName].forEach(category => {
                const item = document.createElement('div');
                item.className = 'category-manager-item';
                item.innerHTML = `
                    <div class="category-manager-info">
                        <span class="category-color-dot" style="background-color: ${category.color}"></span>
                        <span>${category.name}</span>
                    </div>
                    <div class="category-manager-actions">
                        <button class="btn btn-small btn-danger" data-id="${category.id}">Delete</button>
                    </div>
                `;

                item.querySelector('.btn-danger').addEventListener('click', async () => {
                    if (confirm(`Delete category "${category.name}"?`)) {
                        await this.categoryManager.deleteCategory(category.id);
                        this.renderCategories();
                        this.renderCategoryManagerList();
                    }
                });

                groupDiv.appendChild(item);
            });

            container.appendChild(groupDiv);
        });
    }

    /**
     * Add a new category
     */
    async addCategory() {
        const group = document.getElementById('categoryGroupSelect').value;
        const name = document.getElementById('categoryNameInput').value.trim();
        const color = document.getElementById('categoryColorInput').value;

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        try {
            const category = await this.categoryManager.addCategory(name, group);
            category.color = color;
            await this.categoryManager.updateCategory(category.id, { color });

            document.getElementById('categoryNameInput').value = '';
            this.renderCategories();
            this.renderCategoryManagerList();
        } catch (error) {
            alert('Error adding category: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Open split transaction modal
     */
    openSplitTransaction(transaction) {
        this.currentSplitTransaction = transaction;

        // If transaction already has splits, load them
        if (transaction.splits && transaction.splits.length > 0) {
            this.currentSplits = JSON.parse(JSON.stringify(transaction.splits)); // Deep copy
        } else {
            this.currentSplits = [];
        }

        // Update modal info
        document.getElementById('splitTransactionDesc').textContent = transaction.description;
        document.getElementById('splitTransactionAmount').textContent = `Amount: ${CSVParser.formatAmount(transaction.amount)}`;

        // Render template buttons
        this.renderSplitTemplateButtons();

        // Render splits list
        this.renderSplitsList();

        // Show modal
        document.getElementById('splitTransactionModal').classList.remove('hidden');
    }

    /**
     * Close split transaction modal
     */
    closeSplitModal() {
        document.getElementById('splitTransactionModal').classList.add('hidden');
        this.currentSplitTransaction = null;
        this.currentSplits = [];
    }

    /**
     * Render template buttons based on transaction
     */
    renderSplitTemplateButtons() {
        const container = document.getElementById('templateButtons');
        container.innerHTML = '';

        // Get suggested templates
        const suggested = this.templateManager.suggestTemplatesForTransaction(this.currentSplitTransaction.description);

        if (suggested.length === 0) {
            // Show all templates if no suggestions
            this.templateManager.getAllTemplates().forEach(template => {
                const btn = this.createTemplateButton(template);
                container.appendChild(btn);
            });
        } else {
            // Show suggested templates first
            suggested.forEach(template => {
                const btn = this.createTemplateButton(template);
                container.appendChild(btn);
            });
        }
    }

    /**
     * Create a template button element
     */
    createTemplateButton(template) {
        const btn = document.createElement('button');
        btn.className = 'template-button';
        btn.textContent = template.name;
        btn.addEventListener('click', () => this.applySplitTemplate(template.id));
        return btn;
    }

    /**
     * Apply a template to current transaction
     */
    applySplitTemplate(templateId) {
        const splits = this.templateManager.applyTemplate(templateId, this.currentSplitTransaction.amount);
        this.currentSplits = splits;
        this.renderSplitsList();
    }

    /**
     * Render splits list
     */
    renderSplitsList() {
        const container = document.getElementById('splitsList');
        container.innerHTML = '';

        this.currentSplits.forEach((split, index) => {
            const row = this.createSplitRow(split, index);
            container.appendChild(row);
        });

        this.updateSplitTotals();
    }

    /**
     * Create a split row element
     */
    createSplitRow(split, index) {
        const row = document.createElement('div');
        row.className = 'split-item';
        row.dataset.index = index;

        row.innerHTML = `
            <select class="form-select split-category">
                <option value="">Select category...</option>
                ${this.renderCategoryOptions(split.categoryId)}
            </select>
            <input type="number" class="split-percentage" value="${split.percentage || 0}" min="0" max="100" step="0.01">
            <span class="split-amount">${CSVParser.formatAmount(split.amount || 0)}</span>
            <button class="btn btn-danger">Remove</button>
        `;

        // Category change event
        row.querySelector('.split-category').addEventListener('change', (e) => {
            this.currentSplits[index].categoryId = e.target.value ? parseInt(e.target.value) : null;
        });

        // Percentage change event
        row.querySelector('.split-percentage').addEventListener('input', (e) => {
            const percentage = parseFloat(e.target.value) || 0;
            this.currentSplits[index].percentage = percentage;

            // Recalculate amount
            const totalAmount = Math.abs(this.currentSplitTransaction.amount);
            const isNegative = this.currentSplitTransaction.amount < 0;
            const amount = totalAmount * percentage / 100;
            this.currentSplits[index].amount = isNegative ? -amount : amount;

            // Update display
            row.querySelector('.split-amount').textContent = CSVParser.formatAmount(this.currentSplits[index].amount);
            this.updateSplitTotals();
        });

        // Remove button event
        row.querySelector('.btn-danger').addEventListener('click', () => {
            this.removeSplitRow(index);
        });

        return row;
    }

    /**
     * Add a new split row
     */
    addSplitRow() {
        this.currentSplits.push({
            categoryId: null,
            percentage: 0,
            amount: 0
        });
        this.renderSplitsList();
    }

    /**
     * Remove a split row
     */
    removeSplitRow(index) {
        this.currentSplits.splice(index, 1);
        this.renderSplitsList();
    }

    /**
     * Update split totals display
     */
    updateSplitTotals() {
        const totalPercentage = this.currentSplits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        const totalAmount = this.currentSplits.reduce((sum, split) => sum + (split.amount || 0), 0);

        document.getElementById('splitPercentageTotal').textContent = `${totalPercentage.toFixed(1)}%`;
        document.getElementById('splitAmountTotal').textContent = CSVParser.formatAmount(totalAmount);

        // Highlight if not 100%
        const percentageEl = document.getElementById('splitPercentageTotal');
        if (Math.abs(totalPercentage - 100) > 0.1) {
            percentageEl.style.color = 'var(--error)';
        } else {
            percentageEl.style.color = 'var(--success)';
        }
    }

    /**
     * Confirm split transaction
     */
    async confirmSplit() {
        // Validate splits
        if (this.currentSplits.length === 0) {
            alert('Please add at least one split');
            return;
        }

        const totalPercentage = this.currentSplits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
            alert('Split percentages must add up to 100%');
            return;
        }

        // Check all splits have categories
        const hasInvalidSplit = this.currentSplits.some(split => !split.categoryId);
        if (hasInvalidSplit) {
            alert('All splits must have a category selected');
            return;
        }

        try {
            // Update transaction with splits
            this.currentSplitTransaction.splits = this.currentSplits;
            this.currentSplitTransaction.isSplit = true;
            this.currentSplitTransaction.categoryId = null; // Clear single category

            await this.db.updateTransaction(this.currentSplitTransaction);
            await this.updateCategoryCounts();
            this.renderCategories();
            this.renderTransactions();
            this.closeSplitModal();

            alert('Transaction split successfully!');
        } catch (error) {
            alert('Error splitting transaction: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Open save split template modal
     */
    openSaveSplitTemplate() {
        if (this.currentSplits.length === 0) {
            alert('Please add splits before saving as template');
            return;
        }

        const totalPercentage = this.currentSplits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
            alert('Split percentages must add up to 100% before saving');
            return;
        }

        // Suggest a name based on merchant
        const merchantName = this.templateManager.extractMerchant(this.currentSplitTransaction.description);
        document.getElementById('templateNameInput').value = merchantName ? `${merchantName} - Custom` : '';

        document.getElementById('saveSplitTemplateModal').classList.remove('hidden');
    }

    /**
     * Close save split template modal
     */
    closeSaveSplitTemplate() {
        document.getElementById('saveSplitTemplateModal').classList.add('hidden');
    }

    /**
     * Confirm save split template
     */
    async confirmSaveSplitTemplate() {
        const name = document.getElementById('templateNameInput').value.trim();
        if (!name) {
            alert('Please enter a template name');
            return;
        }

        try {
            await this.templateManager.createTemplateFromTransaction(name, this.currentSplitTransaction);
            this.closeSaveSplitTemplate();
            alert('Template saved successfully!');
        } catch (error) {
            alert('Error saving template: ' + error.message);
            console.error(error);
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MoneyTrackerApp();
    app.init();

    // Setup create rule confirmation button
    document.getElementById('confirmCreateRuleBtn').addEventListener('click', () => app.confirmCreateRule());
    document.getElementById('cancelCreateRuleBtn').addEventListener('click', () => app.closeCreateRuleModal());

    // Make app globally accessible for debugging
    window.app = app;
});
