/**
 * Permission Domain Entity
 *
 * Pure domain object — represents one atomic action in the RBAC model.
 * Examples: create_transaction, read_analytics, manage_users
 */

import { ValidationError } from '../errors/DomainError.js';

export class Permission {
  /**
   * @param {object} props
   * @param {number} [props.id]
   * @param {string} props.name
   * @param {string} [props.description]
   * @param {string} [props.createdAt]
   */
  constructor({ id, name, description = '', createdAt }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt || new Date().toISOString();

    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length < 1) {
      throw new ValidationError('Permission name is required and must be non-empty.');
    }

    // Enforce snake_case naming convention
    const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    if (!snakeCaseRegex.test(this.name)) {
      throw new ValidationError(
        `Permission name "${this.name}" must be in snake_case format (e.g., create_transaction).`
      );
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
    };
  }
}
