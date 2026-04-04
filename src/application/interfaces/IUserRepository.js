/**
 * IUserRepository — Repository Interface (Application Layer)
 *
 * Defines the contract for user data access. The Infrastructure layer
 * provides the concrete implementation (SqliteUserRepository).
 *
 * All queries MUST filter by deleted_at IS NULL (soft-delete aware).
 */

/**
 * @typedef {object} IUserRepository
 * @property {(id: number) => object|null} findById
 * @property {(email: string) => object|null} findByEmail
 * @property {(user: object) => object} create
 * @property {(user: object) => object} update
 * @property {(id: number) => boolean} softDelete
 */

// This file serves as documentation for the interface.
// JavaScript doesn't have native interfaces, so implementations
// must conform to this contract by convention.

export const IUserRepository = {
  findById: 'findById(id) → User | null',
  findByEmail: 'findByEmail(email) → User | null',
  create: 'create({ name, email, passwordHash }) → User',
  update: 'update(User) → User',
  softDelete: 'softDelete(id) → boolean',
};
