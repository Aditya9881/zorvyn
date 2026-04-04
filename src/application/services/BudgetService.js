/**
 * BudgetService — Application Layer
 *
 * Budget management with remaining-budget calculation.
 * Budgets are informational — they don't block transactions.
 * The 'remaining' field tells the frontend how much budget is left.
 */

import { Transaction } from '../../domain/entities/Transaction.js';
import {
  NotFoundError,
  ValidationError,
} from '../../domain/errors/DomainError.js';

export class BudgetService {
  /**
   * @param {object} deps
   * @param {import('../../infrastructure/repositories/SqliteBudgetRepository').SqliteBudgetRepository} deps.budgetRepository
   * @param {import('../../infrastructure/repositories/SqliteTransactionRepository').SqliteTransactionRepository} deps.transactionRepository
   */
  constructor({ budgetRepository, transactionRepository }) {
    this.budgetRepository = budgetRepository;
    this.transactionRepository = transactionRepository;
  }

  /**
   * Set or update a budget.
   * Accepts dollars, converts to cents for storage.
   *
   * @param {number} userId
   * @param {object} input
   * @param {string} input.category
   * @param {string} input.limit - Dollar string (e.g., "500.00")
   * @param {string} input.yearMonth - 'YYYY-MM'
   * @returns {object}
   */
  setBudget(userId, { category, limit, yearMonth }) {
    if (!category || !limit || !yearMonth) {
      throw new ValidationError('category, limit, and yearMonth are required.');
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new ValidationError('yearMonth must be in YYYY-MM format.');
    }

    const monthlyLimitCents = Transaction.dollarsToCents(limit);

    // Normalize category to Title Case (matching transaction normalization)
    const normalizedCategory = category.trim().replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );

    const budget = this.budgetRepository.upsert({
      userId,
      category: normalizedCategory,
      monthlyLimitCents,
      yearMonth,
    });

    return this._toDisplay(budget);
  }

  /**
   * Get budgets for a month with remaining amounts.
   * Calculates: remaining = limit - actual expense for that category.
   *
   * @param {number} userId
   * @param {string} yearMonth - 'YYYY-MM'
   * @returns {object[]}
   */
  getBudgets(userId, yearMonth) {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new ValidationError('yearMonth query parameter is required (YYYY-MM).');
    }

    const budgets = this.budgetRepository.findByUserAndMonth(userId, yearMonth);

    // Get actual spend per category for this month
    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const categorySpend = this.transactionRepository.getCategorySummary(userId, {
      type: 'expense',
      startDate,
      endDate,
    });

    return budgets.map((budget) => {
      const spend = categorySpend.find(
        (s) => s.category.toLowerCase() === budget.category.toLowerCase()
      );
      const spentCents = spend ? spend.totalAmount : 0;
      const remainingCents = budget.monthlyLimitCents - spentCents;

      return {
        ...this._toDisplay(budget),
        spent: Transaction.centsToDollars(spentCents),
        remaining: Transaction.centsToDollars(remainingCents),
      };
    });
  }

  /**
   * Delete a budget.
   * @param {number} id
   * @param {number} userId
   */
  deleteBudget(id, userId) {
    const deleted = this.budgetRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Budget with ID ${id} not found.`);
    }
    return true;
  }

  /**
   * Convert DB row to display format (dollar strings).
   * @param {object} budget
   * @returns {object}
   */
  _toDisplay(budget) {
    return {
      id: budget.id,
      userId: budget.userId,
      category: budget.category,
      limit: Transaction.centsToDollars(budget.monthlyLimitCents),
      yearMonth: budget.yearMonth,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
