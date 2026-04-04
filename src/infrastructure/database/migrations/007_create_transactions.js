/**
 * Migration: Create transactions table
 *
 * DEVELOPMENT_SPEC.md compliance:
 * - Section III: BIGINT storage in minor units (cents). $100.00 = 10000.
 *   SQLite INTEGER is signed 64-bit, holding up to $92,233,720,368,547,758.07.
 * - Section III: type is binary — 'income' or 'expense' (DB-level CHECK).
 * - Section IX:  Soft delete via deleted_at column.
 * - Section IV:  Indexes on user_id, type, category, date for multi-criteria filtering.
 *
 * Amount is ALWAYS in cents (integer). Conversion to/from dollars
 * happens exclusively in the Domain Entity layer.
 *
 * Date is date-only YYYY-MM-DD for accounting ledger standards.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
      category    TEXT    NOT NULL,
      amount      INTEGER NOT NULL CHECK (amount > 0),
      note        TEXT    DEFAULT '',
      date        TEXT    NOT NULL,
      deleted_at  TEXT    DEFAULT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Individual indexes for single-column filtering (spec Section IV)
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id
      ON transactions(user_id);

    CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON transactions(type);

    CREATE INDEX IF NOT EXISTS idx_transactions_category
      ON transactions(category);

    CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON transactions(date);

    -- Composite covering index for dashboard queries:
    -- "all non-deleted transactions for user X in date range Y"
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date
      ON transactions(user_id, date) WHERE deleted_at IS NULL;
  `);
}

export const name = '007_create_transactions';
