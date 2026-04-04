/**
 * Token Service — Infrastructure / Security Layer
 *
 * Dual-token JWT implementation per DEVELOPMENT_SPEC.md:
 * - Access Token: Short-lived (15 min), sent in response body
 * - Refresh Token: Long-lived (7 days), stored in HttpOnly cookie
 *
 * Token payload: { sub: userId, roles: [...], permissions: [...] }
 *
 * M4 Enhancement: userId→JTI tracking for immediate revocation
 * when an Admin deactivates a user. revokeAllUserTokens(userId)
 * bans every active JTI for that user in one call.
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/index.js';

// In-memory revocation list (production: Redis)
const revokedTokens = new Set();

// userId → Set<jti> mapping for bulk revocation on deactivation
const userTokens = new Map();

/**
 * Registers a JTI under a user ID for later bulk revocation.
 * @param {number} userId
 * @param {string} jti
 */
function trackToken(userId, jti) {
  if (!userTokens.has(userId)) {
    userTokens.set(userId, new Set());
  }
  userTokens.get(userId).add(jti);
}

/**
 * Generates a short-lived access token.
 * @param {object} payload
 * @param {number} payload.sub - User ID
 * @param {string[]} payload.roles - Role names
 * @param {string[]} payload.permissions - Permission names
 * @returns {string} signed JWT
 */
export function generateAccessToken({ sub, roles, permissions }) {
  const jti = uuidv4();
  trackToken(sub, jti);
  return jwt.sign(
    { sub, roles, permissions, jti, type: 'access' },
    config.jwt.accessTokenSecret,
    { expiresIn: config.jwt.accessTokenExpiry }
  );
}

/**
 * Generates a long-lived refresh token.
 * @param {object} payload
 * @param {number} payload.sub - User ID
 * @returns {string} signed JWT
 */
export function generateRefreshToken({ sub }) {
  const jti = uuidv4();
  trackToken(sub, jti);
  return jwt.sign(
    { sub, jti, type: 'refresh' },
    config.jwt.refreshTokenSecret,
    { expiresIn: config.jwt.refreshTokenExpiry }
  );
}

/**
 * Verifies and decodes an access token.
 * Also checks the in-memory revocation list.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {Error} if invalid, expired, or revoked
 */
export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, config.jwt.accessTokenSecret);

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type: expected access token.');
  }

  if (revokedTokens.has(decoded.jti)) {
    throw new Error('Token has been revoked.');
  }

  return decoded;
}

/**
 * Verifies and decodes a refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {Error} if invalid or expired
 */
export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, config.jwt.refreshTokenSecret);

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token.');
  }

  if (revokedTokens.has(decoded.jti)) {
    throw new Error('Token has been revoked.');
  }

  return decoded;
}

/**
 * Revokes a single token by JTI.
 * @param {string} jti
 */
export function revokeToken(jti) {
  revokedTokens.add(jti);
}

/**
 * Revokes ALL tokens for a user (access + refresh).
 * Called when an Admin deactivates a user — ensures immediate session death.
 * @param {number} userId
 * @returns {number} count of tokens revoked
 */
export function revokeAllUserTokens(userId) {
  const jtis = userTokens.get(userId);
  if (!jtis) return 0;

  let count = 0;
  for (const jti of jtis) {
    revokedTokens.add(jti);
    count++;
  }

  // Clear the user's tracking set
  userTokens.delete(userId);
  return count;
}

/**
 * Checks if a token JTI has been revoked.
 * @param {string} jti
 * @returns {boolean}
 */
export function isTokenRevoked(jti) {
  return revokedTokens.has(jti);
}

/**
 * Clears all revoked tokens and user tracking (for testing only).
 */
export function clearRevokedTokens() {
  revokedTokens.clear();
  userTokens.clear();
}
