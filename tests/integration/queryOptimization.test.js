/**
 * Integration Tests: Query Optimization
 *
 * Uses EXPLAIN QUERY PLAN to verify that our indexes are being
 * used correctly for trend reports and summary queries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/infrastructure/database/migrator.js';

describe('Query Optimization', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('trend query uses idx_transactions_user_date index', () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT
           SUBSTR(date, 1, 7) AS month,
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
           COUNT(*) AS transactionCount
         FROM transactions
         WHERE user_id = 1
           AND deleted_at IS NULL
           AND date >= '2026-01-01'
           AND date <= '2026-12-31'
         GROUP BY SUBSTR(date, 1, 7)
         ORDER BY month ASC`
      )
      .all();

    const planText = plan.map((r) => r.detail).join(' ');
    // Should use the composite partial index
    expect(planText).toContain('idx_transactions_user_date');
  });

  it('getSummary query uses idx_transactions_user_date for date-filtered queries', () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
           COUNT(*) AS transactionCount
         FROM transactions
         WHERE user_id = 1
           AND deleted_at IS NULL
           AND date >= '2026-01-01'
           AND date <= '2026-03-31'`
      )
      .all();

    const planText = plan.map((r) => r.detail).join(' ');
    expect(planText).toContain('idx_transactions_user_date');
  });

  it('findByUserId query uses user_id index', () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT id, user_id, type, category, amount, note, date
         FROM transactions
         WHERE user_id = 1 AND deleted_at IS NULL
         ORDER BY id DESC
         LIMIT 21`
      )
      .all();

    const planText = plan.map((r) => r.detail).join(' ');
    // Should use either idx_transactions_user_id or idx_transactions_user_date
    const usesIndex =
      planText.includes('idx_transactions_user_id') ||
      planText.includes('idx_transactions_user_date');
    expect(usesIndex).toBe(true);
  });
});
