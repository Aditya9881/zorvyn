/**
 * UserService — Application Layer
 *
 * Handles user management use cases:
 * - List all users (Admin-only)
 * - Get user by ID with roles/permissions
 * - Deactivate / activate user
 * - Assign / remove role (Admin-only)
 *
 * M4 Enhancement: Deactivation triggers immediate token revocation
 * via revokeAllUserTokens(userId), ensuring the deactivated user's
 * sessions die instantly.
 */

import {
  NotFoundError,
  ConflictError,
} from '../../domain/errors/DomainError.js';
import { revokeAllUserTokens } from '../../infrastructure/security/tokenService.js';

export class UserService {
  /**
   * @param {object} deps
   * @param {import('../../infrastructure/repositories/SqliteUserRepository').SqliteUserRepository} deps.userRepository
   * @param {import('../../infrastructure/repositories/SqliteRoleRepository').SqliteRoleRepository} deps.roleRepository
   * @param {import('../../infrastructure/repositories/SqlitePermissionRepository').SqlitePermissionRepository} deps.permissionRepository
   */
  constructor({ userRepository, roleRepository, permissionRepository }) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
  }

  /**
   * List all active users with their roles.
   * @returns {object[]}
   */
  listUsers() {
    const users = this.userRepository.findAll();
    return users.map((user) => {
      const roles = this.roleRepository.findByUserId(user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        roles: roles.map((r) => r.name),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });
  }

  /**
   * Get user by ID with their roles and permissions.
   * @param {number} id
   * @returns {object}
   */
  getUserById(id) {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found.`);
    }

    const roles = this.roleRepository.findByUserId(id);
    const permissions = this.permissionRepository.findByUserId(id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.name),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Deactivate a user account.
   * CRITICAL: Also revokes ALL of the user's active JWT tokens
   * so their sessions die immediately.
   *
   * @param {number} id
   * @returns {object} { user, tokensRevoked }
   */
  deactivateUser(id) {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found.`);
    }

    const updated = this.userRepository.update({ ...user, isActive: false });

    // Immediately revoke all tokens for this user
    const tokensRevoked = revokeAllUserTokens(id);

    return {
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        isActive: updated.isActive,
      },
      tokensRevoked,
    };
  }

  /**
   * Activate a user account.
   * @param {number} id
   * @returns {object}
   */
  activateUser(id) {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found.`);
    }

    const updated = this.userRepository.update({ ...user, isActive: true });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      isActive: updated.isActive,
    };
  }

  /**
   * Assign a role to a user (Admin-only).
   * @param {number} userId
   * @param {string} roleName
   * @returns {object} updated user with roles
   */
  assignRole(userId, roleName) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found.`);
    }

    const role = this.roleRepository.findByName(roleName);
    if (!role) {
      throw new NotFoundError(`Role "${roleName}" not found.`);
    }

    // Check if already assigned
    const currentRoles = this.roleRepository.findByUserId(userId);
    const alreadyAssigned = currentRoles.some((r) => r.id === role.id);
    if (alreadyAssigned) {
      throw new ConflictError(`User already has the "${roleName}" role.`);
    }

    this.roleRepository.assignToUser(userId, role.id);

    return this.getUserById(userId);
  }

  /**
   * Remove a role from a user (Admin-only).
   * @param {number} userId
   * @param {string} roleName
   * @returns {object} updated user with roles
   */
  removeRole(userId, roleName) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found.`);
    }

    const role = this.roleRepository.findByName(roleName);
    if (!role) {
      throw new NotFoundError(`Role "${roleName}" not found.`);
    }

    const currentRoles = this.roleRepository.findByUserId(userId);
    const hasRole = currentRoles.some((r) => r.id === role.id);
    if (!hasRole) {
      throw new NotFoundError(`User does not have the "${roleName}" role.`);
    }

    this.roleRepository.removeFromUser(userId, role.id);

    return this.getUserById(userId);
  }
}
