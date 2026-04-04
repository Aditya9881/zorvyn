/**
 * Transaction Domain Entity
 *
 * Pure domain object — zero framework imports.
 *
 * DEVELOPMENT_SPEC.md compliance:
 * - Section III: All monetary values stored as integers in cents (BIGINT).
 *   $100.00 = 10000. No floating-point math touches persistence.
 * - Section III: Type is binary — 'income' or 'expense'.
 * - Section IX:  Soft delete via deletedAt.
 *
 * Category normalization: trimmed + Title Case ("food" → "Food").
 * Date format: YYYY-MM-DD (date-only for accounting ledger standard).
 * API exchange: dollars as strings ("100.00") to prevent JS float contamination.
 */

import { ValidationError } from '../errors/DomainError.js';

const VALID_TYPES = ['income', 'expense'];

export class Transaction {
  /**
   * @param {object} props
   * @param {number}  [props.id]
   * @param {number}  props.userId
   * @param {string}  props.type         - 'income' or 'expense'
   * @param {string}  props.category     - Free-form, normalized to Title Case
   * @param {number}  props.amountInCents - Positive integer (BIGINT-safe)
   * @param {string}  [props.note='']
   * @param {string}  props.date         - YYYY-MM-DD
   * @param {string|null} [props.deletedAt=null]
   * @param {string}  [props.createdAt]
   * @param {string}  [props.updatedAt]
   */
  constructor({
    id,
    userId,
    type,
    category,
    amountInCents,
    note = '',
    date,
    deletedAt = null,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.category = Transaction.normalizeCategory(category);
    this.amountInCents = amountInCents;
    this.note = note || '';
    this.date = date;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();

    this.validate();
  }

  // ─── Validation ──────────────────────────────────────────────

  /**
   * Validates all business invariants.
   * @throws {ValidationError}
   */
  validate() {
    // User ID
    if (this.userId === undefined || this.userId === null) {
      throw new ValidationError('Transaction must belong to a user (userId required).');
    }

    // Type: must be 'income' or 'expense'
    if (!this.type || !VALID_TYPES.includes(this.type)) {
      throw new ValidationError(
        `Transaction type must be one of: ${VALID_TYPES.join(', ')}. Got: "${this.type}".`
      );
    }

    // Category: non-empty after normalization
    if (!this.category || typeof this.category !== 'string' || this.category.trim().length < 1) {
      throw new ValidationError('Category is required and must be non-empty.');
    }

    // Amount: must be a positive integer (cents)
    if (this.amountInCents === undefined || this.amountInCents === null) {
      throw new ValidationError('Amount in cents is required.');
    }

    if (!Number.isInteger(this.amountInCents)) {
      throw new ValidationError(
        `Amount must be a whole integer (cents). Got: ${this.amountInCents}. ` +
        'Use Transaction.dollarsToCents() to convert from dollars.'
      );
    }

    if (this.amountInCents <= 0) {
      throw new ValidationError(
        `Amount must be positive (greater than 0 cents). Got: ${this.amountInCents}.`
      );
    }

    // Date: must be YYYY-MM-DD
    if (!this.date || typeof this.date !== 'string') {
      throw new ValidationError('Date is required.');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(this.date)) {
      throw new ValidationError(
        `Date must be in YYYY-MM-DD format. Got: "${this.date}".`
      );
    }

    // Verify it's a real date (not 2026-13-45)
    const parsed = new Date(this.date + 'T00:00:00Z');
    if (isNaN(parsed.getTime())) {
      throw new ValidationError(`Date "${this.date}" is not a valid calendar date.`);
    }
  }

  // ─── BigInt-Safe Currency Conversion ─────────────────────────

  /**
   * Converts a dollar amount to cents (integer).
   * This is the ONLY approved way to go from dollars → cents.
   *
   * Uses Math.round to handle sub-cent precision (e.g., 10.005 → 1001).
   * Rejects zero and negative values.
   *
   * @param {number|string} dollars - e.g., 100.00 or "100.00"
   * @returns {number} integer cents
   * @throws {ValidationError} if zero or negative
   */
  static dollarsToCents(dollars) {
    const parsed = typeof dollars === 'string' ? parseFloat(dollars) : dollars;

    if (isNaN(parsed)) {
      throw new ValidationError(`Cannot convert "${dollars}" to cents: not a valid number.`);
    }

    if (parsed <= 0) {
      throw new ValidationError(
        `Dollar amount must be positive. Got: ${parsed}.`
      );
    }

    // Multiply by 100 and round to eliminate floating-point noise.
    // e.g., 10.005 * 100 = 1000.4999… → Math.round → 1001
    return Math.round(parsed * 100);
  }

  /**
   * Converts cents (integer) to a dollar string.
   * Returns a STRING to prevent the frontend's JavaScript from
   * accidentally introducing floating-point errors in JSON parsing.
   *
   * @param {number} cents - integer cents
   * @returns {string} e.g., "100.00", "19.99", "0.01"
   */
  static centsToDollars(cents) {
    if (!Number.isInteger(cents)) {
      throw new ValidationError(`Cents must be an integer. Got: ${cents}.`);
    }

    const dollars = Math.floor(cents / 100);
    const remainder = Math.abs(cents % 100);

    return `${dollars}.${remainder.toString().padStart(2, '0')}`;
  }

  // ─── Category Normalization ──────────────────────────────────

  /**
   * Normalizes category to Title Case.
   * "food" → "Food", "GROCERIES" → "Groceries", "  gas & Fuel  " → "Gas & Fuel"
   *
   * @param {string} category
   * @returns {string}
   */
  static normalizeCategory(category) {
    if (!category || typeof category !== 'string') return '';

    return category
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s|[&\-/])\S/g, (match) => match.toUpperCase());
  }

  // ─── Soft Delete ─────────────────────────────────────────────

  /**
   * Marks the transaction as soft-deleted.
   * Per spec: records are never truly erased.
   */
  softDelete() {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Restores a soft-deleted transaction.
   */
  restore() {
    this.deletedAt = null;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @returns {boolean}
   */
  isDeleted() {
    return this.deletedAt !== null;
  }

  // ─── Serialization ───────────────────────────────────────────

  /**
   * Returns the entity as stored (cents).
   * Used by repositories for persistence.
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      category: this.category,
      amountInCents: this.amountInCents,
      note: this.note,
      date: this.date,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Returns the entity with amount as a dollar string.
   * Used by the Presentation layer to send to the frontend.
   *
   * Amount is returned as a STRING ("100.00") instead of a number
   * to prevent the frontend's JSON.parse from introducing float errors.
   */
  toDisplayJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      category: this.category,
      amount: Transaction.centsToDollars(this.amountInCents),
      note: this.note,
      date: this.date,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
