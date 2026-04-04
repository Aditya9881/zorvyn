/**
 * Unit Tests: User Domain Entity
 *
 * U1: Create valid User entity
 * U2: Reject empty email
 * U3: Soft delete sets deletedAt
 */

import { describe, it, expect } from 'vitest';
import { User } from '../../../src/domain/entities/User.js';

describe('User Entity', () => {
  const validProps = {
    name: 'Aditya Sonkar',
    email: 'aditya@zorvyn.com',
    passwordHash: '$2b$12$fakehashforUnittesting000000000000000000000000',
  };

  // U1: Create valid User entity
  describe('U1: Valid User Creation', () => {
    it('should create a User with all fields populated', () => {
      const user = new User(validProps);

      expect(user.name).toBe('Aditya Sonkar');
      expect(user.email).toBe('aditya@zorvyn.com');
      expect(user.passwordHash).toBeDefined();
      expect(user.isActive).toBe(true);
      expect(user.deletedAt).toBeNull();
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should NOT include passwordHash in toSafeJSON()', () => {
      const user = new User(validProps);
      const safe = user.toSafeJSON();

      expect(safe.name).toBe('Aditya Sonkar');
      expect(safe.email).toBe('aditya@zorvyn.com');
      expect(safe.isActive).toBe(true);
      expect(safe).not.toHaveProperty('passwordHash');
      expect(safe).not.toHaveProperty('password_hash');
      expect(safe).not.toHaveProperty('deletedAt');
    });
  });

  // U2: Reject invalid input
  describe('U2: Validation', () => {
    it('should throw ValidationError for empty name', () => {
      expect(() => new User({ ...validProps, name: '' })).toThrow('User name is required');
    });

    it('should throw ValidationError for name exceeding 100 chars', () => {
      expect(() => new User({ ...validProps, name: 'A'.repeat(101) })).toThrow(
        'must not exceed 100 characters'
      );
    });

    it('should throw ValidationError for empty email', () => {
      expect(() => new User({ ...validProps, email: '' })).toThrow('Email is required');
    });

    it('should throw ValidationError for invalid email format', () => {
      expect(() => new User({ ...validProps, email: 'not-an-email' })).toThrow(
        'Email format is invalid'
      );
    });

    it('should throw ValidationError for missing passwordHash', () => {
      expect(() => new User({ ...validProps, passwordHash: '' })).toThrow(
        'Password hash is required'
      );
    });
  });

  // U3: Soft delete
  describe('U3: Soft Delete', () => {
    it('should set deletedAt when soft-deleted', () => {
      const user = new User(validProps);
      expect(user.isDeleted()).toBe(false);

      user.softDelete();

      expect(user.isDeleted()).toBe(true);
      expect(user.deletedAt).not.toBeNull();
      expect(user.isActive).toBe(false);
    });

    it('should restore a soft-deleted user', () => {
      const user = new User(validProps);
      user.softDelete();
      expect(user.isDeleted()).toBe(true);

      user.restore();

      expect(user.isDeleted()).toBe(false);
      expect(user.deletedAt).toBeNull();
    });

    it('should deactivate without soft-deleting', () => {
      const user = new User(validProps);
      user.deactivate();

      expect(user.isActive).toBe(false);
      expect(user.isDeleted()).toBe(false);
    });
  });
});
