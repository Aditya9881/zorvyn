/**
 * SqliteUserRepository — Infrastructure Layer
 *
 * Concrete implementation of IUserRepository using better-sqlite3.
 * All read queries include WHERE deleted_at IS NULL (soft-delete aware).
 */

export class SqliteUserRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Find active user by ID.
   * @param {number} id
   * @returns {object|null}
   */
  findById(id) {
    return this.db
      .prepare(
        `SELECT id, name, email, password_hash AS passwordHash,
                is_active AS isActive, deleted_at AS deletedAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM users
         WHERE id = ? AND deleted_at IS NULL`
      )
      .get(id) || null;
  }

  /**
   * Find active user by email.
   * @param {string} email
   * @returns {object|null}
   */
  findByEmail(email) {
    return this.db
      .prepare(
        `SELECT id, name, email, password_hash AS passwordHash,
                is_active AS isActive, deleted_at AS deletedAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM users
         WHERE email = ? AND deleted_at IS NULL`
      )
      .get(email) || null;
  }

  /**
   * Find all active (non-deleted) users.
   * @returns {object[]}
   */
  findAll() {
    return this.db
      .prepare(
        `SELECT id, name, email,
                is_active AS isActive, deleted_at AS deletedAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM users
         WHERE deleted_at IS NULL
         ORDER BY id ASC`
      )
      .all();
  }

  /**
   * Create a new user.
   * @param {object} props
   * @returns {object} the created user row
   */
  create({ name, email, passwordHash }) {
    const stmt = this.db.prepare(
      `INSERT INTO users (name, email, password_hash)
       VALUES (?, ?, ?)`
    );
    const result = stmt.run(name, email, passwordHash);

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Update an existing user.
   * @param {object} user
   * @returns {object} the updated user row
   */
  update(user) {
    this.db
      .prepare(
        `UPDATE users
         SET name = ?, email = ?, is_active = ?,
             updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(user.name, user.email, user.isActive ? 1 : 0, user.id);

    return this.findById(user.id);
  }

  /**
   * Soft-delete a user (sets deleted_at, never truly erases).
   * @param {number} id
   * @returns {boolean}
   */
  softDelete(id) {
    const result = this.db
      .prepare(
        `UPDATE users
         SET deleted_at = datetime('now'),
             is_active = 0,
             updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(id);

    return result.changes > 0;
  }
}
