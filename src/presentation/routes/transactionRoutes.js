/**
 * Transaction Routes — Presentation Layer
 *
 * Maps HTTP endpoints to TransactionController with RBAC middleware.
 * Replaces the M1 transaction stubs with real handlers.
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
 * @returns {Router}
 */
export function createTransactionRoutes(controller) {
  const router = Router();

  // GET /api/v1/transactions — List with filters + cursor pagination
  router.get(
    '/',
    authenticate,
    authorize('read_transactions'),
    validateFilters,
    controller.list
  );

  // GET /api/v1/transactions/:id — Single record
  router.get(
    '/:id',
    authenticate,
    authorize('read_transactions'),
    controller.getById
  );

  // POST /api/v1/transactions — Create new
  router.post(
    '/',
    authenticate,
    authorize('create_transaction'),
    validateCreateTransaction,
    controller.create
  );

  // PUT /api/v1/transactions/:id — Update existing
  router.put(
    '/:id',
    authenticate,
    authorize('update_transaction'),
    validateUpdateTransaction,
    controller.update
  );

  // DELETE /api/v1/transactions/:id — Soft delete
  router.delete(
    '/:id',
    authenticate,
    authorize('delete_transaction'),
    controller.softDelete
  );

  return router;
}
