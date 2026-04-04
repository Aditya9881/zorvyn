/**
 * Analytics Routes — Presentation Layer
 *
 * Dashboard summary, category breakdown, trends, and AI insights.
 * Requires 'read_analytics' permission (Analyst + Admin only).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateFilters } from '../validators/transactionValidators.js';

/**
 * @param {import('../controllers/TransactionController').TransactionController} controller
 * @param {object} [opts={}]
 * @param {import('../controllers/InsightController').InsightController} [opts.insightController]
 * @returns {Router}
 */
export function createAnalyticsRoutes(controller, opts = {}) {
  const router = Router();

  /**
   * @openapi
   * /analytics/summary:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Financial summary
   *     description: Returns total income, total expense, and net balance for the authenticated user. Supports date range filtering.
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Summary data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     summary:
   *                       $ref: '#/components/schemas/Summary'
   *       403:
   *         description: Insufficient permissions
   */
  router.get(
    '/summary',
    authenticate,
    authorize('read_analytics'),
    validateFilters,
    controller.getSummary
  );

  /**
   * @openapi
   * /analytics/categories:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Category breakdown
   *     description: Returns totals grouped by category and transaction type. Useful for pie charts and spending distribution analysis.
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [income, expense]
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Category summary array
   */
  router.get(
    '/categories',
    authenticate,
    authorize('read_analytics'),
    validateFilters,
    controller.getCategorySummary
  );

  /**
   * @openapi
   * /analytics/trends:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Monthly trends
   *     description: Returns 12-month income and expense totals bucketed by month. Gap-filled with zeros for months without transactions. Designed for line chart rendering.
   *     parameters:
   *       - in: query
   *         name: year
   *         schema:
   *           type: integer
   *           example: 2026
   *     responses:
   *       200:
   *         description: Monthly trend array
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     trends:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           month:
   *                             type: string
   *                             example: "2026-01"
   *                           income:
   *                             type: string
   *                             example: "500.00"
   *                           expense:
   *                             type: string
   *                             example: "200.00"
   */
  router.get(
    '/trends',
    authenticate,
    authorize('read_analytics'),
    controller.getTrends
  );

  /**
   * @openapi
   * /analytics/ai-insights:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: AI-powered financial insights
   *     description: Analyzes the user's last 30 days of spending against 8 rule-based patterns and returns prioritized, actionable financial tips. Detects budget overruns, high spend-to-income ratios, single-source income risk, and more.
   *     responses:
   *       200:
   *         description: Insights array with period and summary
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   type: object
   *                   properties:
   *                     insights:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             enum: [warning, caution, suggestion, positive, info]
   *                           category:
   *                             type: string
   *                           title:
   *                             type: string
   *                           message:
   *                             type: string
   *                           priority:
   *                             type: string
   *                             enum: [high, medium, low]
   *                     period:
   *                       type: object
   *                       properties:
   *                         startDate:
   *                           type: string
   *                         endDate:
   *                           type: string
   *                         days:
   *                           type: integer
   *                     summary:
   *                       $ref: '#/components/schemas/Summary'
   *       403:
   *         description: Insufficient permissions
   */
  if (opts.insightController) {
    router.get(
      '/ai-insights',
      authenticate,
      authorize('read_analytics'),
      opts.insightController.getInsights
    );
  }

  return router;
}
