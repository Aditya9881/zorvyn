/**
 * SqliteBudgetRepository — Infrastructure Layer
 *
 * Manages budget CRUD. Budgets are configuration, not financial records,
 * so they support true DELETE (no soft-delete).
 */

export class SqliteBudgetRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Upsert a budget (INSERT OR REPLACE on unique constraint).
   * @param {object} props
   * @returns {object}
   */
  upsert({ userId, category, monthlyLimitCents, yearMonth }) {
    // Try to find existing
    const existing = this.findByUserCategoryMonth(userId, category, yearMonth);

    if (existing) {
      this.db
        .prepare(
          `UPDATE budgets SET monthly_limit = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(monthlyLimitCents, existing.id);
      return this.findById(existing.id);
    }

    const result = this.db
      .prepare(
        `INSERT INTO budgets (user_id, category, monthly_limit, year_month)
         VALUES (?, ?, ?, ?)`
      )
      .run(userId, category, monthlyLimitCents, yearMonth);

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find budget by ID.
   * @param {number} id
   * @returns {object|null}
   */
  findById(id) {
    return this.db
      .prepare(
        `SELECT id, user_id AS userId, category,
                monthly_limit AS monthlyLimitCents, year_month AS yearMonth,
                created_at AS createdAt, updated_at AS updatedAt
         FROM budgets WHERE id = ?`
      )
      .get(id) || null;
  }

  /**
   * Find all budgets for a user in a given month.
   * @param {number} userId
   * @param {string} yearMonth - 'YYYY-MM'
   * @returns {object[]}
   */
  findByUserAndMonth(userId, yearMonth) {
    return this.db
      .prepare(
        `SELECT id, user_id AS userId, category,
                monthly_limit AS monthlyLimitCents, year_month AS yearMonth,
                created_at AS createdAt, updated_at AS updatedAt
         FROM budgets
         WHERE user_id = ? AND year_month = ?
         ORDER BY category ASC`
      )
      .all(userId, yearMonth);
  }

  /**
   * Find a single budget for a user/category/month.
   * @param {number} userId
   * @param {string} category
   * @param {string} yearMonth
   * @returns {object|null}
   */
  findByUserCategoryMonth(userId, category, yearMonth) {
    return this.db
      .prepare(
        `SELECT id, user_id AS userId, category,
                monthly_limit AS monthlyLimitCents, year_month AS yearMonth,
                created_at AS createdAt, updated_at AS updatedAt
         FROM budgets
         WHERE user_id = ? AND category = ? AND year_month = ?`
      )
      .get(userId, category, yearMonth) || null;
  }

  /**
   * True delete — budgets are config, not financial records.
   * @param {number} id
   * @param {number} userId - ownership check
   * @returns {boolean}
   */
  delete(id, userId) {
    const result = this.db
      .prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  }
}
