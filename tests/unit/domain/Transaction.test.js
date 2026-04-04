/**
 * Unit Tests: Transaction Domain Entity — BigInt Math Validation
 *
 * Phase C of Milestone 2: These tests MUST all pass before any API
 * routes are written for transactions.
 *
 * BM1:  Dollar-to-cents basic           → 100.00 = 10000
 * BM2:  Dollar-to-cents fractional      → 19.99 = 1999
 * BM3:  Dollar-to-cents sub-cent round  → 10.005 = 1001
 * BM4:  Dollar-to-cents zero            → throws ValidationError
 * BM5:  Cents-to-dollars basic          → 10000 = "100.00"
 * BM6:  Cents-to-dollars with pennies   → 1999 = "19.99"
 * BM7:  Cents-to-dollars single cent    → 1 = "0.01"
 * BM8:  Addition precision trap         → 10.10 + 10.20 as cents = 2030
 * BM9:  Large value arithmetic          → $92,233,720,368.55 stores correctly
 * BM10: Zero balance calculation        → income 5000 - expense 5000 = 0
 * BM11: Negative amount rejected        → -500 throws ValidationError
 * BM12: Float amount rejected as cents  → 99.999 as amountInCents throws
 */

import { describe, it, expect } from 'vitest';
import { Transaction } from '../../../src/domain/entities/Transaction.js';

describe('Transaction Entity — BigInt Math Validation', () => {
  // Shared valid props for entity construction
  const validProps = {
    userId: 1,
    type: 'expense',
    category: 'Groceries',
    amountInCents: 10000,
    date: '2026-04-04',
  };

  // ═══════════════════════════════════════════════════════════════
  // DOLLAR → CENTS CONVERSION
  // ═══════════════════════════════════════════════════════════════

  describe('dollarsToCents()', () => {
    // BM1: Basic conversion
    it('BM1: converts $100.00 to 10000 cents', () => {
      expect(Transaction.dollarsToCents(100.00)).toBe(10000);
    });

    it('BM1b: converts string "100.00" to 10000 cents', () => {
      expect(Transaction.dollarsToCents('100.00')).toBe(10000);
    });

    // BM2: Fractional dollars
    it('BM2: converts $19.99 to 1999 cents', () => {
      expect(Transaction.dollarsToCents(19.99)).toBe(1999);
    });

    // BM3: Sub-cent precision → rounds to nearest cent
    it('BM3: rounds $10.005 to 1001 cents', () => {
      expect(Transaction.dollarsToCents(10.005)).toBe(1001);
    });

    it('BM3b: rounds $10.004 to 1000 cents', () => {
      expect(Transaction.dollarsToCents(10.004)).toBe(1000);
    });

    // BM4: Zero dollar amount → rejected
    it('BM4: rejects zero dollar amount', () => {
      expect(() => Transaction.dollarsToCents(0)).toThrow('must be positive');
    });

    it('BM4b: rejects negative dollar amount', () => {
      expect(() => Transaction.dollarsToCents(-50)).toThrow('must be positive');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CENTS → DOLLARS CONVERSION
  // ═══════════════════════════════════════════════════════════════

  describe('centsToDollars()', () => {
    // BM5: Basic conversion
    it('BM5: converts 10000 cents to "100.00"', () => {
      expect(Transaction.centsToDollars(10000)).toBe('100.00');
    });

    // BM6: With pennies
    it('BM6: converts 1999 cents to "19.99"', () => {
      expect(Transaction.centsToDollars(1999)).toBe('19.99');
    });

    // BM7: Single cent
    it('BM7: converts 1 cent to "0.01"', () => {
      expect(Transaction.centsToDollars(1)).toBe('0.01');
    });

    it('BM7b: converts 0 cents to "0.00"', () => {
      expect(Transaction.centsToDollars(0)).toBe('0.00');
    });

    it('BM7c: returns string type, not number', () => {
      const result = Transaction.centsToDollars(10000);
      expect(typeof result).toBe('string');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THE CRITICAL FLOATING-POINT TRAP TEST (SPEC SECTION III)
  // ═══════════════════════════════════════════════════════════════

  describe('Floating-Point Precision', () => {
    // BM8: The classic 0.1 + 0.2 trap
    // In raw JavaScript: 0.1 + 0.2 = 0.30000000000000004
    // In raw JavaScript: 10.10 + 10.20 = 20.299999999999997
    // Our cent pipeline MUST produce exact results.
    it('BM8: $10.10 + $10.20 stored as cents sums to exactly 2030', () => {
      // Simulate the real pipeline: frontend sends dollars → dollarsToCents → store → sum
      const amount1 = Transaction.dollarsToCents(10.10); // 1010
      const amount2 = Transaction.dollarsToCents(10.20); // 1020

      // Integer addition — no floating-point contamination
      const sum = amount1 + amount2;

      expect(amount1).toBe(1010);
      expect(amount2).toBe(1020);
      expect(sum).toBe(2030); // NOT 2029 or 2030.0000000001

      // Convert back to dollars for display
      expect(Transaction.centsToDollars(sum)).toBe('20.30');
    });

    it('BM8b: $0.10 + $0.20 = exactly 30 cents', () => {
      const a = Transaction.dollarsToCents(0.10);
      const b = Transaction.dollarsToCents(0.20);
      const sum = a + b;

      expect(a).toBe(10);
      expect(b).toBe(20);
      expect(sum).toBe(30);
      expect(Transaction.centsToDollars(sum)).toBe('0.30');
    });

    it('BM8c: round-trip preserves precision', () => {
      // Start with dollars, convert to cents, convert back
      const originalDollars = '99.99';
      const cents = Transaction.dollarsToCents(originalDollars);
      const backToDollars = Transaction.centsToDollars(cents);

      expect(cents).toBe(9999);
      expect(backToDollars).toBe('99.99');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LARGE VALUE ARITHMETIC
  // ═══════════════════════════════════════════════════════════════

  describe('Large Values', () => {
    // BM9: Large value within safe integer range
    // JavaScript Number.MAX_SAFE_INTEGER = 9007199254740991
    // That's $90,071,992,547,409.91 — well beyond any practical amount
    it('BM9: handles $92,233,720,368.55 as 9223372036855 cents', () => {
      const largeCents = 9223372036855;

      // Verify it's within safe integer range
      expect(largeCents).toBeLessThan(Number.MAX_SAFE_INTEGER);

      // Verify conversion back to dollars
      const dollars = Transaction.centsToDollars(largeCents);
      expect(dollars).toBe('92233720368.55');

      // Verify entity creation works with large value
      const tx = new Transaction({
        ...validProps,
        amountInCents: largeCents,
      });
      expect(tx.amountInCents).toBe(9223372036855);
    });

    it('BM9b: arithmetic with large values is exact', () => {
      const a = 9223372036800;
      const b = 55;
      expect(a + b).toBe(9223372036855);
      expect(Transaction.centsToDollars(a + b)).toBe('92233720368.55');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ZERO BALANCE CALCULATION
  // ═══════════════════════════════════════════════════════════════

  describe('Zero Balance', () => {
    // BM10: Income - Expense = 0
    it('BM10: income 5000 cents minus expense 5000 cents equals zero', () => {
      const income = new Transaction({
        userId: 1,
        type: 'income',
        category: 'Salary',
        amountInCents: 5000,
        date: '2026-04-01',
      });

      const expense = new Transaction({
        userId: 1,
        type: 'expense',
        category: 'Rent',
        amountInCents: 5000,
        date: '2026-04-01',
      });

      const netBalance = income.amountInCents - expense.amountInCents;

      expect(netBalance).toBe(0);
      expect(Transaction.centsToDollars(netBalance)).toBe('0.00');
    });

    it('BM10b: multiple transactions net to zero', () => {
      const incomes = [1000, 2000, 3000]; // cents
      const expenses = [1500, 2500, 2000]; // cents

      const totalIncome = incomes.reduce((a, b) => a + b, 0);
      const totalExpense = expenses.reduce((a, b) => a + b, 0);
      const net = totalIncome - totalExpense;

      expect(totalIncome).toBe(6000);
      expect(totalExpense).toBe(6000);
      expect(net).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // INVALID AMOUNT REJECTION
  // ═══════════════════════════════════════════════════════════════

  describe('Amount Validation', () => {
    // BM11: Negative amount rejected
    it('BM11: rejects negative amountInCents', () => {
      expect(
        () => new Transaction({ ...validProps, amountInCents: -500 })
      ).toThrow('must be positive');
    });

    it('BM11b: rejects zero amountInCents', () => {
      expect(
        () => new Transaction({ ...validProps, amountInCents: 0 })
      ).toThrow('must be positive');
    });

    // BM12: Float as amountInCents rejected
    it('BM12: rejects float as amountInCents (must be integer)', () => {
      expect(
        () => new Transaction({ ...validProps, amountInCents: 99.999 })
      ).toThrow('whole integer');
    });

    it('BM12b: rejects NaN as amountInCents', () => {
      expect(
        () => new Transaction({ ...validProps, amountInCents: NaN })
      ).toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ENTITY VALIDATION & NORMALIZATION
  // ═══════════════════════════════════════════════════════════════

  describe('Entity Construction & Normalization', () => {
    it('should create a valid Transaction entity', () => {
      const tx = new Transaction(validProps);

      expect(tx.userId).toBe(1);
      expect(tx.type).toBe('expense');
      expect(tx.category).toBe('Groceries');
      expect(tx.amountInCents).toBe(10000);
      expect(tx.date).toBe('2026-04-04');
    });

    it('should normalize category to Title Case', () => {
      const tx = new Transaction({ ...validProps, category: '  food & drink  ' });
      expect(tx.category).toBe('Food & Drink');
    });

    it('should normalize "GROCERIES" to "Groceries"', () => {
      const tx = new Transaction({ ...validProps, category: 'GROCERIES' });
      expect(tx.category).toBe('Groceries');
    });

    it('should reject invalid type', () => {
      expect(
        () => new Transaction({ ...validProps, type: 'transfer' })
      ).toThrow('must be one of');
    });

    it('should reject invalid date format', () => {
      expect(
        () => new Transaction({ ...validProps, date: '04-04-2026' })
      ).toThrow('YYYY-MM-DD');
    });

    it('should reject invalid calendar date', () => {
      expect(
        () => new Transaction({ ...validProps, date: '2026-13-45' })
      ).toThrow('not a valid calendar date');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SOFT DELETE
  // ═══════════════════════════════════════════════════════════════

  describe('Soft Delete', () => {
    it('should soft-delete and restore', () => {
      const tx = new Transaction(validProps);
      expect(tx.isDeleted()).toBe(false);

      tx.softDelete();
      expect(tx.isDeleted()).toBe(true);
      expect(tx.deletedAt).not.toBeNull();

      tx.restore();
      expect(tx.isDeleted()).toBe(false);
      expect(tx.deletedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DISPLAY JSON (API OUTPUT)
  // ═══════════════════════════════════════════════════════════════

  describe('toDisplayJSON()', () => {
    it('should return amount as dollar string, not number', () => {
      const tx = new Transaction(validProps);
      const json = tx.toDisplayJSON();

      expect(json.amount).toBe('100.00');
      expect(typeof json.amount).toBe('string');
      // Must NOT have amountInCents in display output
      expect(json).not.toHaveProperty('amountInCents');
      // Must NOT have deletedAt in display output
      expect(json).not.toHaveProperty('deletedAt');
    });
  });
});
