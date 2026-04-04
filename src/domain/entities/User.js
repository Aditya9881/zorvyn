/**
 * User Domain Entity
 *
 * Pure domain object — zero framework imports.
 * Encapsulates all user-related business rules and validation.
 *
 * Per DEVELOPMENT_SPEC.md:
 * - Soft delete via deletedAt
 * - is_active flag for account status
 * - passwordHash never exposed via toSafeJSON()
 */

export class User {
  /**
   * @param {object} props
   * @param {number}  [props.id]
   * @param {string}  props.name
   * @param {string}  props.email
   * @param {string}  props.passwordHash
   * @param {boolean} [props.isActive=true]
   * @param {string|null}  [props.deletedAt=null]
   * @param {string}  [props.createdAt]
   * @param {string}  [props.updatedAt]
   */
  constructor({
    id,
    name,
    email,
    passwordHash,
    isActive = true,
    deletedAt = null,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.isActive = isActive;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();

    this.validate();
  }

  /**
   * Validates core business invariants.
   * @throws {Error} if any invariant is violated
   */
  validate() {
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length < 1) {
      throw new ValidationError('User name is required and must be non-empty.');
    }

    if (this.name.trim().length > 100) {
      throw new ValidationError('User name must not exceed 100 characters.');
    }

    if (!this.email || typeof this.email !== 'string') {
      throw new ValidationError('Email is required.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new ValidationError('Email format is invalid.');
    }

    if (!this.passwordHash || typeof this.passwordHash !== 'string') {
      throw new ValidationError('Password hash is required.');
    }
  }

  /**
   * Deactivates the user account.
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Activates the user account.
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Marks the user as soft-deleted.
   * Per spec: records are never truly erased.
   */
  softDelete() {
    this.deletedAt = new Date().toISOString();
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Restores a soft-deleted user.
   */
  restore() {
    this.deletedAt = null;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @returns {boolean} whether this user has been soft-deleted
   */
  isDeleted() {
    return this.deletedAt !== null;
  }

  /**
   * Returns a safe representation that strips the passwordHash.
   * Used by the Presentation layer to prevent leaking credentials.
   * @returns {object}
   */
  toSafeJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// Import error from same domain layer
import { ValidationError } from '../errors/DomainError.js';
