/**
 * Integration Tests: Analytics Endpoints
 *
 * Tests dashboard summary and category breakdown:
 * - Summary returns dollar strings for all monetary fields
 * - Zero-transaction accounts return "0.00"
 * - Date-range filtering affects summary
 * - Category breakdown groups correctly
 * - RBAC: Viewer gets 403, Analyst/Admin gets 200
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Analytics Endpoints', () => {
  let app;
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  async function registerWithRole(name, email, roleName) {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name, email, password: 'SecureP@ss123',
    });
    const userId = reg.body.data.user.id;

    if (roleName !== 'Viewer') {
      const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
      db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, role.id);
    }

    const login = await request(app).post('/api/v1/auth/login').send({
      email, password: 'SecureP@ss123',
    });
    return { token: login.body.data.accessToken, userId };
  }

  async function seedTransactions(token) {
    const transactions = [
      { amount: '3000.00', type: 'income', category: 'Salary', date: '2026-01-15' },
      { amount: '500.00', type: 'income', category: 'Freelance', date: '2026-01-20' },
      { amount: '150.00', type: 'expense', category: 'Food', date: '2026-01-10' },
      { amount: '800.00', type: 'expense', category: 'Rent', date: '2026-01-01' },
      { amount: '50.00', type: 'expense', category: 'Food', date: '2026-02-05' },
      { amount: '200.00', type: 'income', category: 'Freelance', date: '2026-02-10' },
    ];

    for (const tx of transactions) {
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(tx);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/v1/analytics/summary', () => {
    it('should return correct totals as dollar strings', async () => {
      const { token } = await registerWithRole('Admin', 'admin@test.com', 'Admin');
      await seedTransactions(token);

      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const summary = res.body.data.summary;
      // Income: 3000 + 500 + 200 = 3700
      expect(summary.totalIncome).toBe('3700.00');
      // Expense: 150 + 800 + 50 = 1000
      expect(summary.totalExpense).toBe('1000.00');
      // Net: 3700 - 1000 = 2700
      expect(summary.netBalance).toBe('2700.00');
      expect(summary.transactionCount).toBe(6);

      // Verify types are strings
      expect(typeof summary.totalIncome).toBe('string');
      expect(typeof summary.totalExpense).toBe('string');
      expect(typeof summary.netBalance).toBe('string');
    });

    it('should return "0.00" for accounts with zero transactions', async () => {
      const { token } = await registerWithRole('Analyst', 'analyst@test.com', 'Analyst');

      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;
      expect(summary.totalIncome).toBe('0.00');
      expect(summary.totalExpense).toBe('0.00');
      expect(summary.netBalance).toBe('0.00');
      expect(summary.transactionCount).toBe(0);
    });

    it('should filter summary by date range', async () => {
      const { token } = await registerWithRole('Admin', 'admin2@test.com', 'Admin');
      await seedTransactions(token);

      // Only January transactions
      const res = await request(app)
        .get('/api/v1/analytics/summary?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;
      // Jan income: 3000 + 500 = 3500
      expect(summary.totalIncome).toBe('3500.00');
      // Jan expense: 150 + 800 = 950
      expect(summary.totalExpense).toBe('950.00');
      expect(summary.netBalance).toBe('2550.00');
      expect(summary.transactionCount).toBe(4);
    });

    it('should filter summary by type', async () => {
      const { token } = await registerWithRole('Admin', 'admin3@test.com', 'Admin');
      await seedTransactions(token);

      const res = await request(app)
        .get('/api/v1/analytics/summary?type=expense')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Only expense: 150 + 800 + 50 = 1000
      expect(res.body.data.summary.totalExpense).toBe('1000.00');
      expect(res.body.data.summary.totalIncome).toBe('0.00');
      expect(res.body.data.summary.transactionCount).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY BREAKDOWN
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/v1/analytics/categories', () => {
    it('should group by category with dollar string totals', async () => {
      const { token } = await registerWithRole('Admin', 'admin4@test.com', 'Admin');
      await seedTransactions(token);

      const res = await request(app)
        .get('/api/v1/analytics/categories?type=expense')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const categories = res.body.data.categories;

      expect(categories.length).toBeGreaterThanOrEqual(2);

      // Rent: 800, Food: 150 + 50 = 200
      const rent = categories.find((c) => c.category === 'Rent');
      expect(rent.totalAmount).toBe('800.00');
      expect(rent.count).toBe(1);

      const food = categories.find((c) => c.category === 'Food');
      expect(food.totalAmount).toBe('200.00');
      expect(food.count).toBe(2);

      // Dollar strings
      expect(typeof rent.totalAmount).toBe('string');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RBAC ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════

  describe('RBAC on Analytics', () => {
    it('Viewer should get 403 on analytics', async () => {
      const { token } = await registerWithRole('Viewer', 'viewer@test.com', 'Viewer');

      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('Analyst should get 200 on analytics', async () => {
      const { token } = await registerWithRole('Analyst', 'analyst2@test.com', 'Analyst');

      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
