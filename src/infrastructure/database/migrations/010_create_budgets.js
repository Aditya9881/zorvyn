/**
 * Migration: Create budgets table
 *
 * One budget per user per category per month.
 * monthly_limit stored in cents (matching transactions).
 * No deleted_at — budgets are config, not financial records.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category      TEXT    NOT NULL,
      monthly_limit INTEGER NOT NULL CHECK (monthly_limit > 0),
      year_month    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),

      UNIQUE(user_id, category, year_month)
    );

    CREATE INDEX IF NOT EXISTS idx_budgets_user_month
      ON budgets(user_id, year_month);
  `);
}

export const name = '010_create_budgets';
