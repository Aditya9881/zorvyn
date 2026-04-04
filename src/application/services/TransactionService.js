/**
 * TransactionService — Application Layer
 *
 * Orchestrates transaction CRUD with:
 * - Dollar ↔ cent conversion at the boundary
 * - Domain entity validation
 * - Ownership isolation (users only see their own data)
 * - Summary conversion to dollar strings for the Presentation layer
 */

import { Transaction } from '../../domain/entities/Transaction.js';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../domain/errors/DomainError.js';

export class TransactionService {
  /**
   * @param {object} deps
   * @param {import('../../infrastructure/repositories/SqliteTransactionRepository').SqliteTransactionRepository} deps.transactionRepository
   */
  constructor({ transactionRepository }) {
    this.transactionRepository = transactionRepository;
  }

  /**
   * Create a new transaction.
   * Accepts dollars from the API, converts to cents for storage.
   *
   * @param {number} userId - Authenticated user's ID
   * @param {object} input
   * @param {string} input.amount - Dollar string (e.g., "100.00")
   * @param {string} input.type - 'income' or 'expense'
   * @param {string} input.category
   * @param {string} input.date - YYYY-MM-DD
   * @param {string} [input.note]
   * @returns {object} Display JSON with dollar string amount
   */
  create(userId, { amount, type, category, date, note }) {
    // Convert dollars → cents at the application boundary
    const amountInCents = Transaction.dollarsToCents(amount);

    // Validate via domain entity (throws if invalid)
    const entity = new Transaction({
      userId,
      type,
      category,
      amountInCents,
      note: note || '',
      date,
    });

    // Persist
    const row = this.transactionRepository.create({
      userId: entity.userId,
      type: entity.type,
      category: entity.category,
      amountInCents: entity.amountInCents,
      note: entity.note,
      date: entity.date,
    });

    // Return display format (amount as dollar string)
    return this._toDisplay(row);
  }

  /**
   * Get a single transaction by ID.
   * Enforces ownership isolation.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {object}
   */
  getById(id, userId) {
    const row = this.transactionRepository.findById(id);
    if (!row) {
      throw new NotFoundError(`Transaction with ID ${id} not found.`);
    }

    this._checkOwnership(row, userId);

    return this._toDisplay(row);
  }

  /**
   * List transactions with filters and cursor-based pagination.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {{ transactions: object[], nextCursor: number|null, hasMore: boolean }}
   */
  list(userId, filters = {}) {
    // Convert dollar filter amounts to cents if provided
    const repoFilters = { ...filters };
    if (repoFilters.minAmount) {
      repoFilters.minAmount = Transaction.dollarsToCents(repoFilters.minAmount);
    }
    if (repoFilters.maxAmount) {
      repoFilters.maxAmount = Transaction.dollarsToCents(repoFilters.maxAmount);
    }

    const result = this.transactionRepository.findByUserId(userId, repoFilters);

    return {
      transactions: result.transactions.map((row) => this._toDisplay(row)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Update a transaction.
   * Enforces ownership. Accepts dollars, converts to cents.
   *
   * @param {number} id
   * @param {number} userId
   * @param {object} input - Partial update fields
   * @returns {object}
   */
  update(id, userId, input) {
    const existing = this.transactionRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Transaction with ID ${id} not found.`);
    }

    this._checkOwnership(existing, userId);

    // Merge updates with existing values
    const amountInCents = input.amount
      ? Transaction.dollarsToCents(input.amount)
      : existing.amountInCents;

    // Validate merged entity via domain
    const entity = new Transaction({
      id: existing.id,
      userId: existing.userId,
      type: input.type || existing.type,
      category: input.category || existing.category,
      amountInCents,
      note: input.note !== undefined ? input.note : existing.note,
      date: input.date || existing.date,
    });

    const updated = this.transactionRepository.update({
      id: entity.id,
      type: entity.type,
      category: entity.category,
      amountInCents: entity.amountInCents,
      note: entity.note,
      date: entity.date,
    });

    return this._toDisplay(updated);
  }

  /**
   * Soft-delete a transaction.
   * Enforces ownership.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {boolean}
   */
  softDelete(id, userId) {
    const existing = this.transactionRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Transaction with ID ${id} not found.`);
    }

    this._checkOwnership(existing, userId);

    return this.transactionRepository.softDelete(id);
  }

  /**
   * Get financial summary (income, expense, net balance).
   * Returns all values as dollar strings.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {object}
   */
  getSummary(userId, filters = {}) {
    const summary = this.transactionRepository.getSummary(userId, filters);

    return {
      totalIncome: Transaction.centsToDollars(summary.totalIncome),
      totalExpense: Transaction.centsToDollars(summary.totalExpense),
      netBalance: Transaction.centsToDollars(summary.netBalance),
      transactionCount: summary.transactionCount,
    };
  }

  /**
   * Get category breakdown.
   * Returns amounts as dollar strings.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {Array<{ category: string, totalAmount: string, count: number }>}
   */
  getCategorySummary(userId, filters = {}) {
    const rows = this.transactionRepository.getCategorySummary(userId, filters);

    return rows.map((row) => ({
      category: row.category,
      totalAmount: Transaction.centsToDollars(row.totalAmount),
      count: row.count,
    }));
  }

  // ─── Private Helpers ─────────────────────────────────────────

  /**
   * Checks that the requesting user owns the transaction.
   * @param {object} transaction
   * @param {number} requestingUserId
   * @throws {AuthorizationError}
   */
  _checkOwnership(transaction, requestingUserId) {
    if (transaction.userId !== requestingUserId) {
      throw new AuthorizationError(
        'You do not have permission to access this transaction.'
      );
    }
  }

  /**
   * Converts a raw DB row to display format (dollar strings).
   * @param {object} row
   * @returns {object}
   */
  _toDisplay(row) {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      category: row.category,
      amount: Transaction.centsToDollars(row.amountInCents),
      note: row.note,
      date: row.date,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
