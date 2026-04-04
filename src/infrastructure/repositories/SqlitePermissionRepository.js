/**
 * SqlitePermissionRepository — Infrastructure Layer
 *
 * Resolves the full RBAC chain:
 *   user → user_roles → roles → role_permissions → permissions
 *
 * The findByUserId method is the critical path for the authorize middleware.
 */

export class SqlitePermissionRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Find all permissions assigned to a role.
   * @param {number} roleId
   * @returns {object[]}
   */
  findByRoleId(roleId) {
    return this.db
      .prepare(
        `SELECT p.id, p.name, p.description, p.created_at AS createdAt
         FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?`
      )
      .all(roleId);
  }

  /**
   * Resolve ALL permissions for a user through the full RBAC chain.
   * user → user_roles → roles → role_permissions → permissions
   *
   * Returns deduplicated permission names (a user with multiple roles
   * may have overlapping permissions).
   *
   * @param {number} userId
   * @returns {object[]}
   */
  findByUserId(userId) {
    return this.db
      .prepare(
        `SELECT DISTINCT p.id, p.name, p.description, p.created_at AS createdAt
         FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         INNER JOIN user_roles ur ON ur.role_id = rp.role_id
         WHERE ur.user_id = ?`
      )
      .all(userId);
  }
}
