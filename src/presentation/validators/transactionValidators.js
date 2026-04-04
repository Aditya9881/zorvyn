/**
 * Transaction Input Validators — Presentation Layer
 *
 * Validates request body/query at the API edge before reaching the service layer.
 * Per DEVELOPMENT_SPEC.md Section VIII: presence, format, and sanity checks.
 */

import { ValidationError } from '../../domain/errors/DomainError.js';

/**
 * Validates transaction creation input.
 */
export function validateCreateTransaction(req, res, next) {
  const { amount, type, category, date } = req.body;

  if (amount === undefined || amount === null) {
    return next(new ValidationError('Amount is required.'));
  }

  // Amount must be a string or number, and positive
  const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(parsed) || parsed <= 0) {
    return next(new ValidationError('Amount must be a positive number.'));
  }

  if (!type || typeof type !== 'string') {
    return next(new ValidationError('Type is required (income or expense).'));
  }

  if (!['income', 'expense'].includes(type)) {
    return next(new ValidationError('Type must be "income" or "expense".'));
  }

  if (!category || typeof category !== 'string' || category.trim().length < 1) {
    return next(new ValidationError('Category is required.'));
  }

  if (!date || typeof date !== 'string') {
    return next(new ValidationError('Date is required (YYYY-MM-DD).'));
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return next(new ValidationError('Date must be in YYYY-MM-DD format.'));
  }

  next();
}

/**
 * Validates transaction update input (partial update).
 */
export function validateUpdateTransaction(req, res, next) {
  const { amount, type, category, date } = req.body;

  // At least one field must be provided
  if (!amount && !type && !category && !date && req.body.note === undefined) {
    return next(new ValidationError('At least one field is required for update.'));
  }

  if (amount !== undefined) {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(parsed) || parsed <= 0) {
      return next(new ValidationError('Amount must be a positive number.'));
    }
  }

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    return next(new ValidationError('Type must be "income" or "expense".'));
  }

  if (category !== undefined && (typeof category !== 'string' || category.trim().length < 1)) {
    return next(new ValidationError('Category must be non-empty.'));
  }

  if (date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return next(new ValidationError('Date must be in YYYY-MM-DD format.'));
    }
  }

  next();
}

/**
 * Sanitizes and validates query parameters for filtering.
 * Prevents injection via LIKE pattern and invalid values.
 */
export function validateFilters(req, res, next) {
  const { type, startDate, endDate, limit, cursor } = req.query;

  if (type && !['income', 'expense'].includes(type)) {
    return next(new ValidationError('Filter type must be "income" or "expense".'));
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    return next(new ValidationError('startDate must be in YYYY-MM-DD format.'));
  }
  if (endDate && !dateRegex.test(endDate)) {
    return next(new ValidationError('endDate must be in YYYY-MM-DD format.'));
  }

  if (limit) {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      return next(new ValidationError('Limit must be between 1 and 100.'));
    }
  }

  if (cursor) {
    const parsed = parseInt(cursor, 10);
    if (isNaN(parsed) || parsed < 1) {
      return next(new ValidationError('Cursor must be a positive integer.'));
    }
  }

  next();
}
