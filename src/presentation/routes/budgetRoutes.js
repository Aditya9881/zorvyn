/**
 * Budget Routes — Presentation Layer
 *
 * Users can manage their own budgets.
 * Requires create_transaction permission (same users who create transactions
 * should be able to budget for them).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

/**
 * @param {import('../controllers/BudgetController').BudgetController} controller
 * @returns {Router}
 */
export function createBudgetRoutes(controller) {
  const router = Router();

  /**
   * @openapi
   * /budgets:
   *   post:
   *     tags:
   *       - Budgets
   *     summary: Set or update a monthly budget
   *     description: Creates or upserts a budget for a specific category and month. Amounts are in dollar strings. If a budget already exists for the same category/month, it is updated.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - category
   *               - limit
   *               - yearMonth
   *             properties:
   *               category:
   *                 type: string
   *                 example: Groceries
   *               limit:
   *                 type: string
   *                 example: "500.00"
   *                 description: Monthly budget limit (dollar string)
   *               yearMonth:
   *                 type: string
   *                 example: "2026-04"
   *                 description: Budget period in YYYY-MM format
   *     responses:
   *       201:
   *         description: Budget created or updated
   *       400:
   *         description: Validation error
   */
  router.post('/', authenticate, authorize('create_transaction'), controller.setBudget);

  /**
   * @openapi
   * /budgets:
   *   get:
   *     tags:
   *       - Budgets
   *     summary: List budgets with remaining amounts
   *     description: Returns budgets for the given month with dynamically calculated remaining amounts (limit minus actual spend). Negative remaining indicates overspend.
   *     parameters:
   *       - in: query
   *         name: yearMonth
   *         required: true
   *         schema:
   *           type: string
   *           example: "2026-04"
   *         description: Budget period in YYYY-MM format
   *     responses:
   *       200:
   *         description: Budget list with remaining
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     budgets:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: integer
   *                           category:
   *                             type: string
   *                           limit:
   *                             type: string
   *                             example: "500.00"
   *                           spent:
   *                             type: string
   *                             example: "250.00"
   *                           remaining:
   *                             type: string
   *                             example: "250.00"
   */
  router.get('/', authenticate, authorize('read_transactions'), controller.getBudgets);

  /**
   * @openapi
   * /budgets/{id}:
   *   delete:
   *     tags:
   *       - Budgets
   *     summary: Delete a budget
   *     description: Permanently removes a budget. Budgets are configuration, not financial records, so they are hard-deleted (not soft-deleted).
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Budget deleted
   *       404:
   *         description: Budget not found
   */
  router.delete('/:id', authenticate, authorize('create_transaction'), controller.deleteBudget);

  return router;
}
