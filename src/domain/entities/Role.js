/**
 * Role Domain Entity
 *
 * Pure domain object — represents a named collection of permissions.
 * Per the 5-table RBAC model: Admin, Analyst, Viewer.
 */

import { ValidationError } from '../errors/DomainError.js';

export class Role {
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
      throw new ValidationError('Role name is required and must be non-empty.');
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
