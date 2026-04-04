/**
 * Unit Tests: AuthService
 *
 * U4: Register issues Viewer role by default
 * U5: Login with wrong password throws AuthenticationError
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/infrastructure/database/migrator.js';
import { SqliteUserRepository } from '../../../src/infrastructure/repositories/SqliteUserRepository.js';
import { SqliteRoleRepository } from '../../../src/infrastructure/repositories/SqliteRoleRepository.js';
import { SqlitePermissionRepository } from '../../../src/infrastructure/repositories/SqlitePermissionRepository.js';
import { AuthService } from '../../../src/application/services/AuthService.js';
import { clearRevokedTokens } from '../../../src/infrastructure/security/tokenService.js';

describe('AuthService', () => {
  let db;
  let authService;

  beforeEach(() => {
    // Fresh in-memory database for each test
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    clearRevokedTokens();

    const userRepository = new SqliteUserRepository(db);
    const roleRepository = new SqliteRoleRepository(db);
    const permissionRepository = new SqlitePermissionRepository(db);

    authService = new AuthService({
      userRepository,
      roleRepository,
      permissionRepository,
    });
  });

  // U4: Register issues Viewer role by default
  describe('U4: Registration', () => {
    it('should register a user with Viewer role by default', async () => {
      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecureP@ss123',
      });

      expect(result.user.name).toBe('Test User');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.roles).toEqual(['Viewer']);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      await authService.register({
        name: 'User A',
        email: 'duplicate@example.com',
        password: 'SecureP@ss123',
      });

      await expect(
        authService.register({
          name: 'User B',
          email: 'duplicate@example.com',
          password: 'AnotherP@ss123',
        })
      ).rejects.toThrow('already exists');
    });
  });

  // U5: Login with wrong password
  describe('U5: Login', () => {
    it('should login with correct credentials', async () => {
      await authService.register({
        name: 'Login User',
        email: 'login@example.com',
        password: 'CorrectP@ss123',
      });

      const result = await authService.login({
        email: 'login@example.com',
        password: 'CorrectP@ss123',
      });

      expect(result.user.email).toBe('login@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw AuthenticationError for wrong password', async () => {
      await authService.register({
        name: 'Login User',
        email: 'login@example.com',
        password: 'CorrectP@ss123',
      });

      await expect(
        authService.login({
          email: 'login@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'AnyPassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for deactivated user', async () => {
      const result = await authService.register({
        name: 'Deactivated User',
        email: 'deactivated@example.com',
        password: 'SecureP@ss123',
      });

      // Deactivate directly in DB
      db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(result.user.id);

      await expect(
        authService.login({
          email: 'deactivated@example.com',
          password: 'SecureP@ss123',
        })
      ).rejects.toThrow('deactivated');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      const registerResult = await authService.register({
        name: 'Refresh User',
        email: 'refresh@example.com',
        password: 'SecureP@ss123',
      });

      const refreshResult = await authService.refresh(registerResult.refreshToken);

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      // New tokens should be different from old ones
      expect(refreshResult.accessToken).not.toBe(registerResult.accessToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });
  });
});
