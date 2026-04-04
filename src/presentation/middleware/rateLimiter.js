/**
 * Rate Limiter Middleware — Presentation Layer
 *
 * Protects critical endpoints from brute-force and abuse:
 * - loginLimiter:   5 req / 15 min on /auth/login
 * - createLimiter:  30 req / 1 min on POST /transactions
 * - generalLimiter: 100 req / 1 min on all /api/v1 routes
 *
 * Returns RFC 9457 error on 429 Too Many Requests.
 * In-memory store (production: Redis via rate-limit-redis).
 */

import rateLimit from 'express-rate-limit';

const RFC_9457_429 = {
  type: 'https://api.zorvyn.com/errors/rate-limit-exceeded',
  title: 'Too Many Requests',
  status: 429,
};

/**
 * Strict limiter for login endpoint — brute-force protection.
 * 5 requests per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // Return X-RateLimit-* headers
  legacyHeaders: false,
  message: {
    ...RFC_9457_429,
    detail: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

/**
 * Moderate limiter for transaction creation — abuse prevention.
 * 30 requests per minute per IP.
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...RFC_9457_429,
    detail: 'Too many transactions created. Please slow down.',
  },
});

/**
 * General API limiter — baseline DDoS protection.
 * 100 requests per minute per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...RFC_9457_429,
    detail: 'Too many requests. Please try again later.',
  },
});
