/**
 * Migration: Create idempotent_requests table
 *
 * Stores cached responses keyed by (idempotency_key, user_id).
 * Prevents duplicate transaction creation on retried POST requests.
 * Keys expire after 24 hours.
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT    NOT NULL,
      user_id         INTEGER NOT NULL,
      status_code     INTEGER NOT NULL,
      response_body   TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at      TEXT    NOT NULL,

      UNIQUE(idempotency_key, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_idempotent_key_user
      ON idempotent_requests(idempotency_key, user_id);

    CREATE INDEX IF NOT EXISTS idx_idempotent_expires
      ON idempotent_requests(expires_at);
  `);
}

export const name = '009_create_idempotent_requests';
