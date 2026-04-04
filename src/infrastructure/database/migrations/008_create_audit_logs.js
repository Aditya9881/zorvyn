/**
 * Migration: Create audit_logs table
 *
 * Immutable audit trail for compliance tracking.
 * Captures all write actions (POST, PUT, DELETE) performed by admins.
 *
 * CRITICAL: No deleted_at column — audit logs are NEVER modified or deleted.
 * This is a financial compliance requirement.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id      INTEGER NOT NULL,
      actor_email   TEXT    NOT NULL,
      action        TEXT    NOT NULL,
      resource_type TEXT    NOT NULL,
      resource_id   INTEGER,
      metadata      TEXT    DEFAULT '{}',
      ip_address    TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Query: "all actions by a specific admin"
    CREATE INDEX IF NOT EXISTS idx_audit_actor
      ON audit_logs(actor_id);

    -- Query: "all actions on a specific resource"
    CREATE INDEX IF NOT EXISTS idx_audit_resource
      ON audit_logs(resource_type, resource_id);

    -- Query: time-range compliance reports
    CREATE INDEX IF NOT EXISTS idx_audit_date
      ON audit_logs(created_at);
  `);
}

export const name = '008_create_audit_logs';
