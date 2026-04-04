/**
 * SqliteIdempotencyRepository — Infrastructure Layer
 *
 * Stores and retrieves cached responses for idempotent POST requests.
 * Keys are scoped per user and expire after 24 hours.
 */

export class SqliteIdempotencyRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Find a cached response by idempotency key and user ID.
   * Only returns non-expired entries.
   *
   * @param {string} key
   * @param {number} userId
   * @returns {{ statusCode: number, responseBody: string } | null}
   */
  findByKey(key, userId) {
    const row = this.db
      .prepare(
        `SELECT status_code AS statusCode, response_body AS responseBody
         FROM idempotent_requests
         WHERE idempotency_key = ? AND user_id = ?
           AND expires_at > datetime('now')`
      )
      .get(key, userId);

    return row || null;
  }

  /**
   * Store a response for an idempotency key.
   * Expires after 24 hours.
   *
   * @param {string} key
   * @param {number} userId
   * @param {number} statusCode
   * @param {string} responseBody - JSON string
   */
  store(key, userId, statusCode, responseBody) {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO idempotent_requests
           (idempotency_key, user_id, status_code, response_body, expires_at)
         VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))`
      )
      .run(key, userId, statusCode, responseBody);
  }

  /**
   * Delete expired entries (maintenance/cleanup).
   * @returns {number} count of deleted rows
   */
  cleanup() {
    const result = this.db
      .prepare(`DELETE FROM idempotent_requests WHERE expires_at <= datetime('now')`)
      .run();
    return result.changes;
  }
}
