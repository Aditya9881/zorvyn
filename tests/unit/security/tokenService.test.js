/**
 * Unit Tests: Token Service
 *
 * U6: Access token expires after configured time
 * U7: Revoked token is rejected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeToken,
  clearRevokedTokens,
} from '../../../src/infrastructure/security/tokenService.js';

describe('Token Service', () => {
  beforeEach(() => {
    clearRevokedTokens();
  });

  const payload = {
    sub: 1,
    roles: ['Viewer'],
    permissions: ['read_transactions'],
  };

  describe('Access Token', () => {
    it('should generate and verify a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.roles).toEqual(['Viewer']);
      expect(decoded.permissions).toEqual(['read_transactions']);
      expect(decoded.type).toBe('access');
      expect(decoded.jti).toBeDefined();
    });

    it('should reject a token with invalid signature', () => {
      const token = generateAccessToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });

  describe('Refresh Token', () => {
    it('should generate and verify a valid refresh token', () => {
      const token = generateRefreshToken({ sub: 1 });
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.type).toBe('refresh');
      expect(decoded.jti).toBeDefined();
    });

    it('should reject an access token used as refresh', () => {
      const accessToken = generateAccessToken(payload);
      // Different secrets → JWT throws 'invalid signature' before type check
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it('should reject a refresh token used as access', () => {
      const refreshToken = generateRefreshToken({ sub: 1 });
      // Different secrets → JWT throws 'invalid signature' before type check
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  // U7: Revoked token is rejected
  describe('U7: Token Revocation', () => {
    it('should reject a revoked access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      revokeToken(decoded.jti);

      expect(() => verifyAccessToken(token)).toThrow('revoked');
    });

    it('should reject a revoked refresh token', () => {
      const token = generateRefreshToken({ sub: 1 });
      const decoded = verifyRefreshToken(token);

      revokeToken(decoded.jti);

      expect(() => verifyRefreshToken(token)).toThrow('revoked');
    });
  });
});
