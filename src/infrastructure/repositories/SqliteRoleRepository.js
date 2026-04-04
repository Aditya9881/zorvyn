/**
 * SqliteRoleRepository — Infrastructure Layer
 *
 * Concrete implementation of IRoleRepository using better-sqlite3.
 * Manages role lookups and user-role assignments via the user_roles junction.
 */

export class SqliteRoleRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Find a role by its ID.
   * @param {number} id
   * @returns {object|null}
   */
  findById(id) {
    return this.db
      .prepare('SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = ?')
      .get(id) || null;
  }

  /**
   * Find a role by its name (e.g., 'Viewer', 'Admin').
   * @param {string} name
   * @returns {object|null}
   */
  findByName(name) {
    return this.db
      .prepare('SELECT id, name, description, created_at AS createdAt FROM roles WHERE name = ?')
      .get(name) || null;
  }

  /**
   * Find all roles assigned to a user.
   * Joins through user_roles junction table.
   * @param {number} userId
   * @returns {object[]}
   */
  findByUserId(userId) {
    return this.db
      .prepare(
        `SELECT r.id, r.name, r.description, r.created_at AS createdAt
         FROM roles r
         INNER JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = ?`
      )
      .all(userId);
  }

  /**
   * Assign a role to a user.
   * @param {number} userId
   * @param {number} roleId
   */
  assignToUser(userId, roleId) {
    this.db
      .prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)')
      .run(userId, roleId);
  }

  /**
   * Remove a role from a user.
   * @param {number} userId
   * @param {number} roleId
   */
  removeFromUser(userId, roleId) {
    this.db
      .prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?')
      .run(userId, roleId);
  }
}
