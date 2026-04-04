/**
 * User Routes — Presentation Layer
 *
 * Admin-only user management endpoints.
 * All routes require authenticate + authorize('manage_users').
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

  /**
   * @openapi
   * /users:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all users
   *     description: Returns all active users with their roles and permissions. Admin only.
   *     responses:
   *       200:
   *         description: User list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     users:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/User'
   *       403:
   *         description: Requires manage_users permission
   */
  router.get('/', authenticate, authorize('manage_users'), controller.listUsers);

  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get user by ID
   *     description: Returns a single user with their roles and permissions. Admin only.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User details
   *       404:
   *         description: User not found
   */
  router.get('/:id', authenticate, authorize('manage_users'), controller.getUserById);

  /**
   * @openapi
   * /users/{id}/roles:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Assign role to user
   *     description: Adds a role (Viewer, Analyst, Admin) to a user. Admin only.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - roleName
   *             properties:
   *               roleName:
   *                 type: string
   *                 example: Analyst
   *     responses:
   *       200:
   *         description: Role assigned
   *       404:
   *         description: User or role not found
   */
  router.post('/:id/roles', authenticate, authorize('manage_users'), controller.assignRole);

  /**
   * @openapi
   * /users/{id}/roles/{roleName}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Remove role from user
   *     description: Removes a role from a user. Cannot remove the last role. Admin only.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: roleName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Role removed
   *       404:
   *         description: User or role not found
   */
  router.delete('/:id/roles/:roleName', authenticate, authorize('manage_users'), controller.removeRole);

  /**
   * @openapi
   * /users/{id}/deactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Deactivate user
   *     description: Sets user to inactive and immediately revokes all JWT tokens. The user cannot log in or make API calls until reactivated. Admin only.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User deactivated and tokens revoked
   *       404:
   *         description: User not found
   */
  router.post('/:id/deactivate', authenticate, authorize('manage_users'), controller.deactivateUser);

  /**
   * @openapi
   * /users/{id}/activate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Activate user
   *     description: Reactivates a previously deactivated user account. Admin only.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User reactivated
   *       404:
   *         description: User not found
   */
  router.post('/:id/activate', authenticate, authorize('manage_users'), controller.activateUser);

  return router;
}
