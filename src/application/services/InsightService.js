/**
 * InsightService — Application Layer
 *
 * AI-powered financial intelligence engine.
 * Analyzes the user's last 30 days of spending patterns and generates
 * actionable, personalized financial tips.
 *
 * Uses deterministic rule-based analysis combined with statistical
 * thresholds to produce insights that feel intelligent and actionable.
 */

import { Transaction } from '../../domain/entities/Transaction.js';

export class InsightService {
  /**
   * @param {object} deps
   * @param {import('../../infrastructure/repositories/SqliteTransactionRepository').SqliteTransactionRepository} deps.transactionRepository
   * @param {import('../../infrastructure/repositories/SqliteBudgetRepository').SqliteBudgetRepository} deps.budgetRepository
   */
  constructor({ transactionRepository, budgetRepository }) {
    this.transactionRepository = transactionRepository;
    this.budgetRepository = budgetRepository;
  }

  /**
   * Generate AI-powered financial insights for the current user.
   * Analyzes last 30 days of transactions and budgets.
   *
   * @param {number} userId
   * @returns {{ insights: object[], period: object, summary: object }}
   */
  generateInsights(userId) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);
    const yearMonth = now.toISOString().slice(0, 7);

    // Gather data
    const summary = this.transactionRepository.getSummary(userId, { startDate, endDate });
    const categories = this.transactionRepository.getCategorySummary(userId, {
      type: 'expense',
      startDate,
      endDate,
    });
    const incomeCategories = this.transactionRepository.getCategorySummary(userId, {
      type: 'income',
      startDate,
      endDate,
    });
    const budgets = this.budgetRepository.findByUserAndMonth(userId, yearMonth);

    // Generate insights
    const insights = [];

    // ─── Rule 1: Spending vs Income Ratio ─────────────────────
    if (summary.totalIncome > 0) {
      const ratio = summary.totalExpense / summary.totalIncome;
      if (ratio > 0.9) {
        insights.push({
          type: 'warning',
          category: 'Overall',
          title: 'High Spend-to-Income Ratio',
          message: `You're spending ${(ratio * 100).toFixed(0)}% of your income. Financial advisors recommend keeping expenses below 80% to build savings.`,
          priority: 'high',
        });
      } else if (ratio < 0.5) {
        insights.push({
          type: 'positive',
          category: 'Overall',
          title: 'Strong Savings Rate',
          message: `Excellent! You're saving ${((1 - ratio) * 100).toFixed(0)}% of your income. Consider investing the surplus in diversified assets.`,
          priority: 'low',
        });
      }
    }

    // ─── Rule 2: Dominant Spending Category ───────────────────
    if (categories.length > 0 && summary.totalExpense > 0) {
      const topCategory = categories[0];
      const topPercent = (topCategory.totalAmount / summary.totalExpense) * 100;

      if (topPercent > 40) {
        insights.push({
          type: 'suggestion',
          category: topCategory.category,
          title: `${topCategory.category} Dominates Spending`,
          message: `${topCategory.category} accounts for ${topPercent.toFixed(0)}% of your expenses (${Transaction.centsToDollars(topCategory.totalAmount)}). Consider setting a budget to track this category.`,
          priority: 'medium',
        });
      }
    }

    // ─── Rule 3: Budget Overruns ──────────────────────────────
    for (const budget of budgets) {
      const catSpend = categories.find(
        (c) => c.category.toLowerCase() === budget.category.toLowerCase()
      );
      if (catSpend) {
        const spentPercent = (catSpend.totalAmount / budget.monthlyLimitCents) * 100;
        if (spentPercent > 100) {
          insights.push({
            type: 'warning',
            category: budget.category,
            title: `${budget.category} Budget Exceeded`,
            message: `You've spent ${Transaction.centsToDollars(catSpend.totalAmount)} of your ${Transaction.centsToDollars(budget.monthlyLimitCents)} budget (${spentPercent.toFixed(0)}%). Review recent ${budget.category.toLowerCase()} purchases for potential savings.`,
            priority: 'high',
          });
        } else if (spentPercent > 75) {
          insights.push({
            type: 'caution',
            category: budget.category,
            title: `${budget.category} Budget Near Limit`,
            message: `You've used ${spentPercent.toFixed(0)}% of your ${budget.category} budget. ${Transaction.centsToDollars(budget.monthlyLimitCents - catSpend.totalAmount)} remaining for the month.`,
            priority: 'medium',
          });
        }
      }
    }

    // ─── Rule 4: Spending Diversification ─────────────────────
    if (categories.length === 1 && summary.totalExpense > 0) {
      insights.push({
        type: 'info',
        category: 'Overall',
        title: 'Single-Category Spending',
        message: `All your expenses are in ${categories[0].category}. If this is intentional, consider tracking other expenses for a complete financial picture.`,
        priority: 'low',
      });
    }

    // ─── Rule 5: Income Diversification ──────────────────────
    if (incomeCategories.length === 1 && summary.totalIncome > 0) {
      insights.push({
        type: 'suggestion',
        category: 'Income',
        title: 'Single Income Source',
        message: `All income comes from "${incomeCategories[0].category}". Diversifying income streams can provide financial resilience against unexpected changes.`,
        priority: 'low',
      });
    }

    // ─── Rule 6: No Transactions ─────────────────────────────
    if (summary.transactionCount === 0) {
      insights.push({
        type: 'info',
        category: 'Overall',
        title: 'No Recent Activity',
        message: 'No transactions recorded in the last 30 days. Start logging your income and expenses to get personalized financial insights.',
        priority: 'medium',
      });
    }

    // ─── Rule 7: High Transaction Volume ─────────────────────
    if (summary.transactionCount > 50) {
      const avgPerDay = (summary.transactionCount / 30).toFixed(1);
      insights.push({
        type: 'info',
        category: 'Overall',
        title: 'Active Financial Tracking',
        message: `You've logged ${summary.transactionCount} transactions (${avgPerDay}/day). Great job maintaining detailed financial records!`,
        priority: 'low',
      });
    }

    // ─── Rule 8: No Budget Set ───────────────────────────────
    if (budgets.length === 0 && categories.length > 0) {
      insights.push({
        type: 'suggestion',
        category: 'Overall',
        title: 'Set Up Budgets',
        message: `You have expenses across ${categories.length} categories but no budgets set. Creating budgets helps control spending and build savings.`,
        priority: 'medium',
      });
    }

    // Sort by priority (high → medium → low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

    return {
      insights,
      period: { startDate, endDate, days: 30 },
      summary: {
        totalIncome: Transaction.centsToDollars(summary.totalIncome),
        totalExpense: Transaction.centsToDollars(summary.totalExpense),
        netBalance: Transaction.centsToDollars(summary.netBalance),
        transactionCount: summary.transactionCount,
        categoryCount: categories.length,
      },
    };
  }
}
