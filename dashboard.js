/**
 * Dashboard for MoneyTracker
 */

class Dashboard {
    constructor() {
        this.db = new MoneyTrackerDB();
        this.categoryManager = null;
        this.transactions = [];
        this.categoryChart = null;
        this.timelineChart = null;
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            console.log('Starting dashboard initialization...');

            // Initialize database
            await this.db.init();

            // Initialize category manager
            this.categoryManager = new CategoryManager(this.db);
            await this.categoryManager.init();

            // Load transactions
            this.transactions = await this.db.getAllTransactions();
            this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Setup UI
            this.setupEventListeners();
            this.refreshDashboard();

            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            alert('Failed to initialize dashboard: ' + error.message);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Export data
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // Dashboard period filter
        document.getElementById('dashboardPeriodSelect').addEventListener('change', () => this.refreshDashboard());
    }

    /**
     * Refresh dashboard data
     */
    refreshDashboard() {
        this.renderCategoryChart();
        this.renderTimelineChart();
        this.renderTopCategories();
        this.renderSummaryStats();
    }

    /**
     * Get filtered transactions based on selected period
     */
    getFilteredTransactions() {
        const period = document.getElementById('dashboardPeriodSelect').value;

        if (period === 'all') {
            return this.transactions;
        }

        const days = parseInt(period);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.transactions.filter(t => new Date(t.date) >= cutoffDate);
    }

    /**
     * Calculate spending by category
     */
    getSpendingByCategory() {
        const filtered = this.getFilteredTransactions();
        const spending = {};

        filtered.forEach(transaction => {
            // Only count expenses (negative amounts)
            if (transaction.amount >= 0) return;

            if (transaction.isSplit && transaction.splits) {
                transaction.splits.forEach(split => {
                    const category = this.categoryManager.getCategoryById(split.categoryId);
                    if (category) {
                        const key = `${category.parent} - ${category.name}`;
                        spending[key] = (spending[key] || 0) + Math.abs(split.amount);
                    }
                });
            } else if (transaction.categoryId) {
                const category = this.categoryManager.getCategoryById(transaction.categoryId);
                if (category) {
                    const key = `${category.parent} - ${category.name}`;
                    spending[key] = (spending[key] || 0) + Math.abs(transaction.amount);
                }
            }
        });

        return spending;
    }

    /**
     * Render category spending chart
     */
    renderCategoryChart() {
        const spending = this.getSpendingByCategory();
        const sortedEntries = Object.entries(spending).sort((a, b) => b[1] - a[1]);
        const labels = sortedEntries.map(([cat]) => cat);
        const data = sortedEntries.map(([, amount]) => amount);

        const ctx = document.getElementById('categoryChart');

        // Destroy existing chart if it exists
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b',
                        '#748ffc', '#ff8787', '#69db7c', '#ffa94d',
                        '#5c7cfa', '#ff922b', '#94d82d', '#fd7e14'
                    ],
                    borderColor: '#2d2d2d',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e0e0e0',
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = CSVParser.formatAmount(-context.parsed);
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render timeline chart
     */
    renderTimelineChart() {
        const filtered = this.getFilteredTransactions();

        // Group by month
        const monthlySpending = {};

        filtered.forEach(transaction => {
            if (transaction.amount >= 0) return; // Only expenses

            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + Math.abs(transaction.amount);
        });

        const sortedMonths = Object.keys(monthlySpending).sort();
        const labels = sortedMonths.map(key => {
            const [year, month] = key.split('-');
            const date = new Date(year, month - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });
        const data = sortedMonths.map(key => monthlySpending[key]);

        const ctx = document.getElementById('timelineChart');

        // Destroy existing chart if it exists
        if (this.timelineChart) {
            this.timelineChart.destroy();
        }

        this.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Spending',
                    data: data,
                    borderColor: '#4a9eff',
                    backgroundColor: 'rgba(74, 158, 255, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Spending: ${CSVParser.formatAmount(-context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#e0e0e0',
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: '#404040'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: '#404040'
                        }
                    }
                }
            }
        });
    }

    /**
     * Render top categories list
     */
    renderTopCategories() {
        const spending = this.getSpendingByCategory();
        const sortedEntries = Object.entries(spending).sort((a, b) => b[1] - a[1]).slice(0, 10);

        const container = document.getElementById('topCategoriesList');
        container.innerHTML = '';

        if (sortedEntries.length === 0) {
            container.innerHTML = '<p class="text-muted">No spending data available</p>';
            return;
        }

        sortedEntries.forEach(([category, amount]) => {
            const item = document.createElement('div');
            item.className = 'stat-item';
            item.innerHTML = `
                <span class="stat-label">${category}</span>
                <span class="stat-value negative">${CSVParser.formatAmount(-amount)}</span>
            `;
            container.appendChild(item);
        });
    }

    /**
     * Render summary statistics
     */
    renderSummaryStats() {
        const filtered = this.getFilteredTransactions();

        let totalSpending = 0;
        let totalIncome = 0;
        let transactionCount = filtered.length;

        filtered.forEach(transaction => {
            if (transaction.amount < 0) {
                totalSpending += Math.abs(transaction.amount);
            } else {
                totalIncome += transaction.amount;
            }
        });

        const netAmount = totalIncome - totalSpending;
        const avgSpending = transactionCount > 0 ? totalSpending / transactionCount : 0;

        const container = document.getElementById('summaryStats');
        container.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Spending</span>
                <span class="stat-value negative">${CSVParser.formatAmount(-totalSpending)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Income</span>
                <span class="stat-value positive">${CSVParser.formatAmount(totalIncome)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Net</span>
                <span class="stat-value ${netAmount >= 0 ? 'positive' : 'negative'}">${CSVParser.formatAmount(netAmount)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Transactions</span>
                <span class="stat-value">${transactionCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Avg Transaction</span>
                <span class="stat-value">${CSVParser.formatAmount(-avgSpending)}</span>
            </div>
        `;
    }

    /**
     * Export all data as JSON
     */
    async exportData() {
        try {
            const data = await this.db.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `moneytracker-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('Error exporting data: ' + error.message);
            console.error(error);
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, creating dashboard...');
    const dashboard = new Dashboard();

    // Make dashboard globally accessible for debugging
    window.dashboard = dashboard;

    // Initialize dashboard
    await dashboard.init();

    console.log('Dashboard ready!');
});
