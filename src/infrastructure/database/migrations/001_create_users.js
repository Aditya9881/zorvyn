/**
 * Migration: Create users table
 * Part of the 5-table RBAC schema (Table 1/5)
 *
 * Follows DEVELOPMENT_SPEC.md:
 * - Soft delete via deleted_at column
 * - Partial unique index on email WHERE deleted_at IS NULL
 *   (allows re-registration after soft delete)
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      deleted_at    TEXT    DEFAULT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active
      ON users(email) WHERE deleted_at IS NULL;
  `);
}

export const name = '001_create_users';
