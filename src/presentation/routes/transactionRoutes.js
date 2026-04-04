/**
 * Transaction Routes — Presentation Layer
 *
 * Maps HTTP endpoints to TransactionController with RBAC middleware.
 * POST /transactions includes idempotency middleware (M6).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  validateCreateTransaction,
  validateUpdateTransaction,
  validateFilters,
} from '../validators/transactionValidators.js';

/**
 * @param {import('../controllers/TransactionController').TransactionController} controller
 * @param {object} [opts={}]
 * @param {Function} [opts.idempotencyMiddleware] - Idempotency middleware for POST
 * @returns {Router}
 */
export function createTransactionRoutes(controller, opts = {}) {
  const router = Router();

  /**
   * @openapi
   * /transactions:
   *   get:
   *     tags:
   *       - Transactions
   *     summary: List transactions
   *     description: Returns transactions with filters and cursor-based pagination. Supports type, category, date range, amount range, and search filters.
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [income, expense]
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
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
   *       - in: query
   *         name: cursor
   *         schema:
   *           type: integer
   *         description: Cursor for pagination (last seen ID)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Paginated transaction list
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
   *                     transactions:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Transaction'
   *                     nextCursor:
   *                       type: integer
   *                       nullable: true
   *                     hasMore:
   *                       type: boolean
   *       403:
   *         description: Insufficient permissions
   */
  router.get(
    '/',
    authenticate,
    authorize('read_transactions'),
    validateFilters,
    controller.list
  );

  /**
   * @openapi
   * /transactions/export:
   *   get:
   *     tags:
   *       - Transactions
   *     summary: Export transactions as CSV
   *     description: Streams all matching transactions as a CSV file. Supports the same filters as the list endpoint. Uses constant memory regardless of result set size.
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [income, expense]
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
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
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/export',
    authenticate,
    authorize('read_transactions'),
    controller.exportCSV
  );

  /**
   * @openapi
   * /transactions/{id}:
   *   get:
   *     tags:
   *       - Transactions
   *     summary: Get transaction by ID
   *     description: Returns a single transaction. Enforces ownership — users can only access their own records.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Transaction found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     transaction:
   *                       $ref: '#/components/schemas/Transaction'
   *       404:
   *         description: Transaction not found
   */
  router.get(
    '/:id',
    authenticate,
    authorize('read_transactions'),
    controller.getById
  );

  /**
   * @openapi
   * /transactions:
   *   post:
   *     tags:
   *       - Transactions
   *     summary: Create transaction
   *     description: Creates a new financial record. Supports idempotency via the Idempotency-Key header to prevent duplicate records from network retries.
   *     parameters:
   *       - in: header
   *         name: Idempotency-Key
   *         schema:
   *           type: string
   *         description: Optional unique key to prevent duplicate creation
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *               - type
   *               - category
   *               - date
   *             properties:
   *               amount:
   *                 type: string
   *                 example: "150.75"
   *                 description: Dollar string (not float)
   *               type:
   *                 type: string
   *                 enum: [income, expense]
   *               category:
   *                 type: string
   *                 example: Groceries
   *               date:
   *                 type: string
   *                 format: date
   *                 example: "2026-04-01"
   *               note:
   *                 type: string
   *                 example: Weekly groceries
   *     responses:
   *       201:
   *         description: Transaction created
   *       400:
   *         description: Validation error
   */
  const createMiddleware = [
    authenticate,
    authorize('create_transaction'),
  ];
  if (opts.idempotencyMiddleware) {
    createMiddleware.push(opts.idempotencyMiddleware);
  }
  createMiddleware.push(validateCreateTransaction, controller.create);
  router.post('/', ...createMiddleware);

  /**
   * @openapi
   * /transactions/{id}:
   *   put:
   *     tags:
   *       - Transactions
   *     summary: Update transaction
   *     description: Updates an existing transaction. Enforces ownership. Accepts dollar strings for amount.
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
   *             properties:
   *               amount:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [income, expense]
   *               category:
   *                 type: string
   *               date:
   *                 type: string
   *                 format: date
   *               note:
   *                 type: string
   *     responses:
   *       200:
   *         description: Transaction updated
   *       404:
   *         description: Not found or not owned
   */
  router.put(
    '/:id',
    authenticate,
    authorize('update_transaction'),
    validateUpdateTransaction,
    controller.update
  );

  /**
   * @openapi
   * /transactions/{id}:
   *   delete:
   *     tags:
   *       - Transactions
   *     summary: Soft delete transaction
   *     description: Marks a transaction as deleted (sets deleted_at). The record is preserved for compliance but hidden from all queries.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Transaction soft-deleted
   *       404:
   *         description: Not found or not owned
   */
  router.delete(
    '/:id',
    authenticate,
    authorize('delete_transaction'),
    controller.softDelete
  );

  return router;
}
