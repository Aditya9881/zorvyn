/**
 * Auth Input Validators — Presentation Layer
 *
 * Input validation at the API edge per DEVELOPMENT_SPEC.md Section VIII:
 * - Presence: mandatory fields present?
 * - Format: email correctly formatted?
 * - Sanity: password meets minimum strength?
 */

import { ValidationError } from '../../domain/errors/DomainError.js';

/**
 * Validates registration input.
 */
export function validateRegister(req, res, next) {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return next(new ValidationError('Name is required.'));
  }

  if (name.trim().length > 100) {
    return next(new ValidationError('Name must not exceed 100 characters.'));
  }

  if (!email || typeof email !== 'string') {
    return next(new ValidationError('Email is required.'));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ValidationError('Invalid email format.'));
  }

  if (!password || typeof password !== 'string') {
    return next(new ValidationError('Password is required.'));
  }

  if (password.length < 8) {
    return next(new ValidationError('Password must be at least 8 characters.'));
  }

  next();
}

/**
 * Validates login input.
 */
export function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    return next(new ValidationError('Email is required.'));
  }

  if (!password || typeof password !== 'string') {
    return next(new ValidationError('Password is required.'));
  }

  next();
}
