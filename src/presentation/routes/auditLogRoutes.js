/**
 * Audit Log Routes — Presentation Layer
 *
 * Admin-only route to query the immutable audit trail.
 * Requires manage_users permission.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

/**
 * @param {import('../controllers/AuditLogController').AuditLogController} controller
 * @returns {Router}
 */
export function createAuditLogRoutes(controller) {
  const router = Router();

  /**
   * @openapi
   * /audit-logs:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Query audit logs
   *     description: Returns the immutable audit trail of all administrative write actions (POST, PUT, DELETE). Supports filtering by actor, resource type, and resource ID. Admin only (manage_users permission).
   *     parameters:
   *       - in: query
   *         name: actorId
   *         schema:
   *           type: integer
   *         description: Filter by the user who performed the action
   *       - in: query
   *         name: resourceType
   *         schema:
   *           type: string
   *           example: transaction
   *         description: Filter by resource type
   *       - in: query
   *         name: resourceId
   *         schema:
   *           type: integer
   *         description: Filter by resource ID
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: Audit log entries
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     logs:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: integer
   *                           actorId:
   *                             type: integer
   *                           action:
   *                             type: string
   *                           resourceType:
   *                             type: string
   *                           resourceId:
   *                             type: integer
   *                           metadata:
   *                             type: object
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                     total:
   *                       type: integer
   *       403:
   *         description: Requires manage_users permission
   */
  router.get('/', authenticate, authorize('manage_users'), controller.list);

  return router;
}
