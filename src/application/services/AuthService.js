/**
 * AuthService — Application Layer
 *
 * Orchestrates authentication use cases:
 * - Register: create user → assign Viewer role → issue tokens
 * - Login: verify credentials → resolve permissions → issue tokens
 * - Refresh: verify refresh token → resolve fresh permissions → issue new access token
 * - Logout: revoke token
 *
 * This service depends on repository interfaces, NOT on infrastructure directly.
 * The concrete repositories are injected via constructor (Dependency Inversion).
 */

import { User } from '../../domain/entities/User.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '../../domain/errors/DomainError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeToken,
} from '../../infrastructure/security/tokenService.js';
import {
  hashPassword,
  comparePassword,
} from '../../infrastructure/security/passwordService.js';

export class AuthService {
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
   * Register a new user.
   * Per spec: every new user starts with "Viewer" role.
   *
   * @param {object} input
   * @param {string} input.name
   * @param {string} input.email
   * @param {string} input.password
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
   */
  async register({ name, email, password }) {
    // Check for existing user
    const existing = this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('A user with this email already exists.');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Validate via domain entity (throws ValidationError if invalid)
    new User({ name, email, passwordHash });

    // Persist user
    const userRow = this.userRepository.create({ name, email, passwordHash });

    // Assign default Viewer role
    const viewerRole = this.roleRepository.findByName('Viewer');
    if (viewerRole) {
      this.roleRepository.assignToUser(userRow.id, viewerRole.id);
    }

    // Resolve roles and permissions for token
    const roles = this.roleRepository.findByUserId(userRow.id);
    const permissions = this.permissionRepository.findByUserId(userRow.id);

    const roleNames = roles.map((r) => r.name);
    const permissionNames = permissions.map((p) => p.name);

    // Issue tokens
    const accessToken = generateAccessToken({
      sub: userRow.id,
      roles: roleNames,
      permissions: permissionNames,
    });
    const refreshToken = generateRefreshToken({ sub: userRow.id });

    return {
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        isActive: userRow.isActive,
        roles: roleNames,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticate a user with email and password.
   *
   * @param {object} input
   * @param {string} input.email
   * @param {string} input.password
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
   */
  async login({ email, password }) {
    const userRow = this.userRepository.findByEmail(email);
    if (!userRow) {
      throw new AuthenticationError('Invalid email or password.');
    }

    if (!userRow.isActive) {
      throw new AuthenticationError('Account is deactivated. Contact an administrator.');
    }

    const isValid = await comparePassword(password, userRow.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password.');
    }

    // Resolve roles and permissions
    const roles = this.roleRepository.findByUserId(userRow.id);
    const permissions = this.permissionRepository.findByUserId(userRow.id);

    const roleNames = roles.map((r) => r.name);
    const permissionNames = permissions.map((p) => p.name);

    const accessToken = generateAccessToken({
      sub: userRow.id,
      roles: roleNames,
      permissions: permissionNames,
    });
    const refreshToken = generateRefreshToken({ sub: userRow.id });

    return {
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        isActive: userRow.isActive,
        roles: roleNames,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh the access token using a valid refresh token.
   * Resolves fresh permissions from the database (in case roles changed).
   *
   * @param {string} refreshTokenStr
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async refresh(refreshTokenStr) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenStr);
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token.');
    }

    const userRow = this.userRepository.findById(decoded.sub);
    if (!userRow) {
      throw new AuthenticationError('User no longer exists.');
    }

    if (!userRow.isActive) {
      throw new AuthenticationError('Account is deactivated.');
    }

    // Resolve fresh roles and permissions
    const roles = this.roleRepository.findByUserId(userRow.id);
    const permissions = this.permissionRepository.findByUserId(userRow.id);

    const roleNames = roles.map((r) => r.name);
    const permissionNames = permissions.map((p) => p.name);

    const accessToken = generateAccessToken({
      sub: userRow.id,
      roles: roleNames,
      permissions: permissionNames,
    });

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken({ sub: userRow.id });

    // Revoke old refresh token
    revokeToken(decoded.jti);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout: revoke the current token.
   * @param {string} jti - Token ID from the decoded JWT
   */
  logout(jti) {
    revokeToken(jti);
  }
}
