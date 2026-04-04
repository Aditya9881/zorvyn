/**
 * SqliteTransactionRepository — Infrastructure Layer
 *
 * Implements ITransactionRepository using better-sqlite3.
 *
 * DEVELOPMENT_SPEC.md compliance:
 * - Section III:  All amounts in cents (INTEGER/BIGINT)
 * - Section IV:   Multi-criteria filtering with parameterized queries
 * - Section V:    SUM/CASE WHEN aggregation for dashboard summaries
 * - Section VI:   Cursor-based pagination using id < cursor
 * - Section IX:   Soft delete — all reads filter WHERE deleted_at IS NULL
 */

export class SqliteTransactionRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  // ─── Private: Shared Filter Builder ──────────────────────────

  /**
   * Builds parameterized WHERE clauses from filter object.
   * Shared between findByUserId, getSummary, and getCategorySummary.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {{ clauses: string[], params: any[] }}
   */
  _buildFilters(userId, filters = {}) {
    const clauses = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [userId];

    if (filters.type) {
      clauses.push('type = ?');
      params.push(filters.type);
    }

    if (filters.category) {
      clauses.push('category = ?');
      params.push(filters.category);
    }

    if (filters.startDate) {
      clauses.push('date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      clauses.push('date <= ?');
      params.push(filters.endDate);
    }

    if (filters.minAmount !== undefined && filters.minAmount !== null) {
      clauses.push('amount >= ?');
      params.push(filters.minAmount);
    }

    if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
      clauses.push('amount <= ?');
      params.push(filters.maxAmount);
    }

    if (filters.search) {
      clauses.push('note LIKE ?');
      params.push(`%${filters.search}%`);
    }

    return { clauses, params };
  }

  // ─── Read Operations ─────────────────────────────────────────

  /**
   * Find a single transaction by ID (soft-delete aware).
   * @param {number} id
   * @returns {object|null}
   */
  findById(id) {
    return this.db
      .prepare(
        `SELECT id, user_id AS userId, type, category,
                amount AS amountInCents, note, date,
                deleted_at AS deletedAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM transactions
         WHERE id = ? AND deleted_at IS NULL`
      )
      .get(id) || null;
  }

  /**
   * Find transactions for a user with multi-criteria filtering
   * and cursor-based pagination.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @param {number} [filters.cursor] - ID cursor (get items with id < cursor)
   * @param {number} [filters.limit=20] - Page size
   * @returns {{ transactions: object[], nextCursor: number|null, hasMore: boolean }}
   */
  findByUserId(userId, filters = {}) {
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const { clauses, params } = this._buildFilters(userId, filters);

    // Cursor-based pagination: get items with id < cursor
    if (filters.cursor) {
      clauses.push('id < ?');
      params.push(filters.cursor);
    }

    const whereClause = clauses.join(' AND ');

    // Fetch limit + 1 to determine hasMore
    const rows = this.db
      .prepare(
        `SELECT id, user_id AS userId, type, category,
                amount AS amountInCents, note, date,
                deleted_at AS deletedAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM transactions
         WHERE ${whereClause}
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(...params, limit + 1);

    const hasMore = rows.length > limit;
    const transactions = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = transactions.length > 0
      ? transactions[transactions.length - 1].id
      : null;

    return { transactions, nextCursor, hasMore };
  }

  // ─── Write Operations ────────────────────────────────────────

  /**
   * Create a new transaction.
   * @param {object} props
   * @returns {object} the created transaction row
   */
  create({ userId, type, category, amountInCents, note, date }) {
    const result = this.db
      .prepare(
        `INSERT INTO transactions (user_id, type, category, amount, note, date)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, type, category, amountInCents, note || '', date);

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Update an existing transaction.
   * @param {object} transaction
   * @returns {object|null} the updated row
   */
  update(transaction) {
    this.db
      .prepare(
        `UPDATE transactions
         SET type = ?, category = ?, amount = ?, note = ?, date = ?,
             updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(
        transaction.type,
        transaction.category,
        transaction.amountInCents,
        transaction.note || '',
        transaction.date,
        transaction.id
      );

    return this.findById(transaction.id);
  }

  /**
   * Soft-delete a transaction.
   * Per spec Section IX: records are never truly erased.
   * @param {number} id
   * @returns {boolean}
   */
  softDelete(id) {
    const result = this.db
      .prepare(
        `UPDATE transactions
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(id);

    return result.changes > 0;
  }

  // ─── Aggregation (Spec Section V) ────────────────────────────

  /**
   * Compute income/expense/net summary using SUM + CASE WHEN.
   * Single-pass aggregation — no subqueries or N+1.
   * All values in cents.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {{ totalIncome: number, totalExpense: number, netBalance: number, transactionCount: number }}
   */
  getSummary(userId, filters = {}) {
    const { clauses, params } = this._buildFilters(userId, filters);
    const whereClause = clauses.join(' AND ');

    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS totalIncome,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
           COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS netBalance,
           COUNT(*) AS transactionCount
         FROM transactions
         WHERE ${whereClause}`
      )
      .get(...params);

    return {
      totalIncome: row.totalIncome,
      totalExpense: row.totalExpense,
      netBalance: row.netBalance,
      transactionCount: row.transactionCount,
    };
  }

  /**
   * Category breakdown for pie charts.
   * Groups by category and sums amounts.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {Array<{ category: string, totalAmount: number, count: number }>}
   */
  getCategorySummary(userId, filters = {}) {
    const { clauses, params } = this._buildFilters(userId, filters);
    const whereClause = clauses.join(' AND ');

    return this.db
      .prepare(
        `SELECT
           category,
           SUM(amount) AS totalAmount,
           COUNT(*)    AS count
         FROM transactions
         WHERE ${whereClause}
         GROUP BY category
         ORDER BY totalAmount DESC`
      )
      .all(...params);
  }

  /**
   * Monthly trend bucketing for line charts.
   * Groups by YYYY-MM using SUBSTR(date, 1, 7).
   * Uses idx_transactions_user_date composite index.
   *
   * @param {number} userId
   * @param {string} year - e.g., '2026'
   * @returns {Array<{ month: string, income: number, expense: number, transactionCount: number }>}
   */
  getTrends(userId, year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    return this.db
      .prepare(
        `SELECT
           SUBSTR(date, 1, 7) AS month,
           COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
           COUNT(*) AS transactionCount
         FROM transactions
         WHERE user_id = ?
           AND deleted_at IS NULL
           AND date >= ?
           AND date <= ?
         GROUP BY SUBSTR(date, 1, 7)
         ORDER BY month ASC`
      )
      .all(userId, startDate, endDate);
  }

  /**
   * Stream all transactions matching filters.
   * Uses .iterate() for lazy evaluation — rows fetched one at a time.
   * Designed for CSV export of 10K+ records without memory issues.
   *
   * @param {number} userId
   * @param {object} [filters={}]
   * @returns {Generator} lazy row iterator
   */
  streamAll(userId, filters = {}) {
    const { clauses, params } = this._buildFilters(userId, filters);
    const whereClause = clauses.join(' AND ');

    return this.db
      .prepare(
        `SELECT id, type, category, amount AS amountInCents,
                note, date, created_at AS createdAt
         FROM transactions
         WHERE ${whereClause}
         ORDER BY date ASC, id ASC`
      )
      .iterate(...params);
  }
}
