/**
 * Migration: Create permissions table
 * Part of the 5-table RBAC schema (Table 3/5)
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export const name = '003_create_permissions';
