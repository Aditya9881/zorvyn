/**
 * Migration: Create user_roles junction table
 * Part of the 5-table RBAC schema (Table 4/5)
 *
 * Many-to-many relationship: Users <-> Roles
 * CASCADE on delete: removing a user/role cleans up assignments.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id)
    );
  `);
}

export const name = '004_create_user_roles';
