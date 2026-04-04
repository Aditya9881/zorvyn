/**
 * User Routes — Presentation Layer
 *
 * Admin-only user management endpoints.
 * All routes require authenticate + authorize('manage_users').
 * Replaces the last remaining stub from M1.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

/**
 * @param {import('../controllers/UserController').UserController} controller
 * @returns {Router}
 */
export function createUserRoutes(controller) {
  const router = Router();

  // GET /api/v1/users — List all active users
  router.get('/', authenticate, authorize('manage_users'), controller.listUsers);

  // GET /api/v1/users/:id — Get user with roles/permissions
  router.get('/:id', authenticate, authorize('manage_users'), controller.getUserById);

  // POST /api/v1/users/:id/roles — Assign role
  router.post('/:id/roles', authenticate, authorize('manage_users'), controller.assignRole);

  // DELETE /api/v1/users/:id/roles/:roleName — Remove role
  router.delete('/:id/roles/:roleName', authenticate, authorize('manage_users'), controller.removeRole);

  // POST /api/v1/users/:id/deactivate — Deactivate + revoke tokens
  router.post('/:id/deactivate', authenticate, authorize('manage_users'), controller.deactivateUser);

  // POST /api/v1/users/:id/activate — Reactivate
  router.post('/:id/activate', authenticate, authorize('manage_users'), controller.activateUser);

  return router;
}
