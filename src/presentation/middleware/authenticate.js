/**
 * Authentication Middleware — Presentation Layer
 *
 * Extracts and verifies the JWT access token from the Authorization header.
 * Attaches the decoded user info to req.user for downstream handlers.
 *
 * Per DEVELOPMENT_SPEC.md Section VII:
 * - Verifies access token signature and expiry
 * - Checks against revocation list
 * - Returns 401 Unauthorized (RFC 9457) on failure
 */

import { verifyAccessToken } from '../../infrastructure/security/tokenService.js';
import { AuthenticationError } from '../../domain/errors/DomainError.js';

/**
 * Middleware that authenticates incoming requests.
 * Must be applied before any authorize() middleware.
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or malformed Authorization header.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AuthenticationError('Token not provided.');
    }

    const decoded = verifyAccessToken(token);

    // Attach user info to request for downstream middleware/controllers
    req.user = {
      id: decoded.sub,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      jti: decoded.jti,
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return next(error);
    }

    // JWT library errors (expired, invalid signature, etc.)
    return next(
      new AuthenticationError(
        error.name === 'TokenExpiredError'
          ? 'Access token has expired.'
          : 'Invalid access token.'
      )
    );
  }
}
