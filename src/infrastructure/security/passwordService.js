/**
 * Password Service — Infrastructure / Security Layer
 *
 * Wraps bcrypt for password hashing and comparison.
 * Salt rounds = 12 per config (good balance of security vs. speed).
 */

import bcrypt from 'bcrypt';
import config from '../../config/index.js';

/**
 * Hashes a plaintext password.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, config.bcrypt.saltRounds);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
