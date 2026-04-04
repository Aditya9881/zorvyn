/**
 * Authorization Middleware — Presentation Layer
 *
 * Factory function that returns middleware checking if the authenticated
 * user has the required permission.
 *
 * This is the **Least Privilege enforcer** per DEVELOPMENT_SPEC.md Section II:
 * - Evaluates req.user.permissions against the required permission
 * - Returns 403 Forbidden (RFC 9457) if denied
 * - Must be used AFTER authenticate middleware
 *
 * Usage:
 *   router.post('/transactions', authenticate, authorize('create_transaction'), handler);
 */

import { AuthorizationError } from '../../domain/errors/DomainError.js';

/**
 * Creates an authorization middleware for a specific permission.
 * @param {string} requiredPermission - The permission name to check (e.g., 'create_transaction')
 * @returns {Function} Express middleware
 */
export function authorize(requiredPermission) {
  return (req, res, next) => {
    // Ensure authenticate middleware ran first
    if (!req.user) {
      return next(
        new AuthorizationError('Authorization check failed: user context not found.')
      );
    }

    const userPermissions = req.user.permissions || [];

    if (!userPermissions.includes(requiredPermission)) {
      return next(
        new AuthorizationError(
          `Permission denied. Required: "${requiredPermission}". ` +
          `Your permissions: [${userPermissions.join(', ')}].`
        )
      );
    }

    next();
  };
}
