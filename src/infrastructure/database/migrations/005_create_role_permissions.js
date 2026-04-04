/**
 * Migration: Create role_permissions junction table
 * Part of the 5-table RBAC schema (Table 5/5)
 *
 * Many-to-many relationship: Roles <-> Permissions
 * CASCADE on delete: removing a role/permission cleans up assignments.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      assigned_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (role_id, permission_id)
    );
  `);
}

export const name = '005_create_role_permissions';
