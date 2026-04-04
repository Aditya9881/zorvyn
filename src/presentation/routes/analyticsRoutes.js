/**
 * Analytics Routes — Presentation Layer
 *
 * Dashboard summary and category breakdown endpoints.
 * Requires 'read_analytics' permission (Analyst + Admin only).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateFilters } from '../validators/transactionValidators.js';

/**
 * @param {import('../controllers/TransactionController').TransactionController} controller
 * @returns {Router}
 */
export function createAnalyticsRoutes(controller) {
  const router = Router();

  // GET /api/v1/analytics/summary — Income/expense/net totals
  router.get(
    '/summary',
    authenticate,
    authorize('read_analytics'),
    validateFilters,
    controller.getSummary
  );

  // GET /api/v1/analytics/categories — Category breakdown
  router.get(
    '/categories',
    authenticate,
    authorize('read_analytics'),
    validateFilters,
    controller.getCategorySummary
  );

  return router;
}
