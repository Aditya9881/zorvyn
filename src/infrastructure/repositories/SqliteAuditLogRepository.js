/**
 * SqliteAuditLogRepository — Infrastructure Layer
 *
 * Stores immutable audit log entries for compliance.
 * INSERT-only — no update or delete operations.
 */

export class SqliteAuditLogRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Create an audit log entry.
   * @param {object} entry
   * @returns {object} the created row
   */
  create({ actorId, actorEmail, action, resourceType, resourceId, metadata, ipAddress }) {
    const result = this.db
      .prepare(
        `INSERT INTO audit_logs (actor_id, actor_email, action, resource_type, resource_id, metadata, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        actorId,
        actorEmail,
        action,
        resourceType,
        resourceId || null,
        typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}'),
        ipAddress || null
      );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find a single audit log entry.
   * @param {number} id
   * @returns {object|null}
   */
  findById(id) {
    const row = this.db
      .prepare(
        `SELECT id, actor_id AS actorId, actor_email AS actorEmail,
                action, resource_type AS resourceType, resource_id AS resourceId,
                metadata, ip_address AS ipAddress, created_at AS createdAt
         FROM audit_logs WHERE id = ?`
      )
      .get(id);

    if (row && row.metadata) {
      try { row.metadata = JSON.parse(row.metadata); } catch { /* keep as string */ }
    }

    return row || null;
  }

  /**
   * Find audit logs by actor (admin user).
   * @param {number} actorId
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  findByActor(actorId, limit = 50) {
    const rows = this.db
      .prepare(
        `SELECT id, actor_id AS actorId, actor_email AS actorEmail,
                action, resource_type AS resourceType, resource_id AS resourceId,
                metadata, ip_address AS ipAddress, created_at AS createdAt
         FROM audit_logs
         WHERE actor_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(actorId, limit);

    return rows.map((row) => {
      if (row.metadata) {
        try { row.metadata = JSON.parse(row.metadata); } catch { /* keep as string */ }
      }
      return row;
    });
  }

  /**
   * Find audit logs by resource.
   * @param {string} resourceType
   * @param {number} resourceId
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  findByResource(resourceType, resourceId, limit = 50) {
    const rows = this.db
      .prepare(
        `SELECT id, actor_id AS actorId, actor_email AS actorEmail,
                action, resource_type AS resourceType, resource_id AS resourceId,
                metadata, ip_address AS ipAddress, created_at AS createdAt
         FROM audit_logs
         WHERE resource_type = ? AND resource_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(resourceType, resourceId, limit);

    return rows.map((row) => {
      if (row.metadata) {
        try { row.metadata = JSON.parse(row.metadata); } catch { /* keep as string */ }
      }
      return row;
    });
  }
}
