/**
 * Global Error Handler — Presentation Layer
 *
 * Catches all errors thrown by controllers/middleware and converts them
 * to RFC 9457 Problem Details JSON responses.
 *
 * Per DEVELOPMENT_SPEC.md Section VIII:
 * - Never leaks stack traces in production
 * - Uses appropriate HTTP status codes (400, 401, 403, 404, 409, 422, 500)
 * - Returns consistent JSON structure
 */

import { DomainError } from '../../domain/errors/DomainError.js';
import config from '../../config/index.js';

/**
 * Express error-handling middleware (4 params).
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // If it's a known domain error, use its RFC 9457 conversion
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json(err.toProblemDetails(req.originalUrl));
  }

  // Unknown/unexpected error
  console.error('[UNHANDLED ERROR]', err);

  const statusCode = err.statusCode || 500;
  const isProduction = config.nodeEnv === 'production';

  return res.status(statusCode).json({
    type: 'https://api.zorvyn.com/errors/internal-server-error',
    title: 'Internal Server Error',
    status: statusCode,
    detail: isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Unknown error',
    ...(req.originalUrl && { instance: req.originalUrl }),
  });
}
