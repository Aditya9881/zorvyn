/**
 * Integration Tests: Transaction CRUD Endpoints
 *
 * Tests the full HTTP flow: create, read, list, update, soft-delete.
 * Verifies cursor-based pagination, multi-criteria filtering,
 * ownership isolation, and dollar-string amounts in responses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Transaction Endpoints', () => {
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

  /** Helper: register an Admin user and return token */
  async function registerAdmin() {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Admin', email: 'admin@test.com', password: 'SecureP@ss123',
    });
    const userId = reg.body.data.user.id;
    // Assign Admin role
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, role.id);
    // Re-login for fresh token with Admin permissions
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com', password: 'SecureP@ss123',
    });
    return { token: login.body.data.accessToken, userId };
  }

  /** Helper: register a Viewer and return token */
  async function registerViewer(email = 'viewer@test.com') {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Viewer', email, password: 'SecureP@ss123',
    });
    return { token: reg.body.data.accessToken, userId: reg.body.data.user.id };
  }

  // ═══════════════════════════════════════════════════════════════
  // CRUD LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe('Full CRUD Lifecycle', () => {
    it('should create, read, update, and soft-delete a transaction', async () => {
      const { token } = await registerAdmin();

      // CREATE
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: '150.75',
          type: 'expense',
          category: 'groceries',
          date: '2026-04-01',
          note: 'Weekly groceries',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.transaction.amount).toBe('150.75');
      expect(typeof createRes.body.data.transaction.amount).toBe('string');
      expect(createRes.body.data.transaction.category).toBe('Groceries'); // Normalized
      expect(createRes.body.data.transaction.type).toBe('expense');

      const txId = createRes.body.data.transaction.id;

      // READ
      const getRes = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.transaction.amount).toBe('150.75');
      expect(getRes.body.data.transaction.id).toBe(txId);

      // UPDATE
      const updateRes = await request(app)
        .put(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '200.00', category: 'food & drink' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.transaction.amount).toBe('200.00');
      expect(updateRes.body.data.transaction.category).toBe('Food & Drink');

      // SOFT DELETE
      const deleteRes = await request(app)
        .delete(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      // Verify soft-deleted record is invisible
      const afterDelete = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(afterDelete.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DOLLAR STRING PRECISION
  // ═══════════════════════════════════════════════════════════════

  describe('Dollar String Precision', () => {
    it('should return amount as string, not number', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '99.99', type: 'income', category: 'Salary', date: '2026-04-01' });

      expect(res.status).toBe(201);
      const tx = res.body.data.transaction;
      expect(typeof tx.amount).toBe('string');
      expect(tx.amount).toBe('99.99');
    });

    it('should handle amounts like $0.01 correctly', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '0.01', type: 'expense', category: 'Fees', date: '2026-04-01' });

      expect(res.status).toBe(201);
      expect(res.body.data.transaction.amount).toBe('0.01');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-CRITERIA FILTERING
  // ═══════════════════════════════════════════════════════════════

  describe('Multi-Criteria Filtering', () => {
    let token;

    beforeEach(async () => {
      const admin = await registerAdmin();
      token = admin.token;

      // Seed test data
      const transactions = [
        { amount: '100.00', type: 'income', category: 'Salary', date: '2026-01-15' },
        { amount: '50.00', type: 'expense', category: 'Food', date: '2026-01-20' },
        { amount: '200.00', type: 'income', category: 'Freelance', date: '2026-02-10' },
        { amount: '30.00', type: 'expense', category: 'Transport', date: '2026-02-15' },
        { amount: '75.00', type: 'expense', category: 'Food', date: '2026-03-01', note: 'starbucks' },
      ];

      for (const tx of transactions) {
        await request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send(tx);
      }
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?type=income')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(2);
      res.body.data.transactions.forEach((tx) => {
        expect(tx.type).toBe('income');
      });
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?category=Food')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?startDate=2026-02-01&endDate=2026-02-28')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(2);
    });

    it('should search by keyword in notes', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?search=starbucks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.transactions[0].note).toContain('starbucks');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CURSOR-BASED PAGINATION
  // ═══════════════════════════════════════════════════════════════

  describe('Cursor-Based Pagination', () => {
    it('should paginate correctly through 25 records', async () => {
      const { token } = await registerAdmin();

      // Seed 25 transactions
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            amount: `${i}.00`,
            type: i % 2 === 0 ? 'income' : 'expense',
            category: 'Test',
            date: '2026-04-01',
          });
      }

      // Page 1: first 10
      const page1 = await request(app)
        .get('/api/v1/transactions?limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.transactions).toHaveLength(10);
      expect(page1.body.data.pagination.hasMore).toBe(true);
      expect(page1.body.data.pagination.nextCursor).toBeDefined();

      // Page 2: next 10
      const cursor1 = page1.body.data.pagination.nextCursor;
      const page2 = await request(app)
        .get(`/api/v1/transactions?limit=10&cursor=${cursor1}`)
        .set('Authorization', `Bearer ${token}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.transactions).toHaveLength(10);
      expect(page2.body.data.pagination.hasMore).toBe(true);

      // Page 3: last 5
      const cursor2 = page2.body.data.pagination.nextCursor;
      const page3 = await request(app)
        .get(`/api/v1/transactions?limit=10&cursor=${cursor2}`)
        .set('Authorization', `Bearer ${token}`);

      expect(page3.status).toBe(200);
      expect(page3.body.data.transactions).toHaveLength(5);
      expect(page3.body.data.pagination.hasMore).toBe(false);

      // No duplicate IDs across pages
      const allIds = [
        ...page1.body.data.transactions,
        ...page2.body.data.transactions,
        ...page3.body.data.transactions,
      ].map((t) => t.id);

      expect(new Set(allIds).size).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // OWNERSHIP ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe('Ownership Isolation', () => {
    it('user A cannot read user B\'s transactions', async () => {
      const adminA = await registerAdmin();
      const { token: viewerBToken, userId: viewerBId } = await registerViewer('userb@test.com');

      // Admin A creates a transaction
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminA.token}`)
        .send({ amount: '100.00', type: 'income', category: 'Salary', date: '2026-04-01' });

      const txId = createRes.body.data.transaction.id;

      // Viewer B (with read_transactions permission) tries to read Admin A's transaction
      // Note: Viewer has read_transactions but the ownership check should block access
      const readRes = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${viewerBToken}`);

      expect(readRes.status).toBe(403);
    });

    it('user A\'s list does not include user B\'s transactions', async () => {
      const adminA = await registerAdmin();

      // Create transaction as Admin A
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminA.token}`)
        .send({ amount: '100.00', type: 'income', category: 'Salary', date: '2026-04-01' });

      // Register Viewer B and list their transactions
      const viewerB = await registerViewer('userb2@test.com');
      const listRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${viewerB.token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.transactions).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════

  describe('Input Validation', () => {
    it('should reject missing amount', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'expense', category: 'Food', date: '2026-04-01' });

      expect(res.status).toBe(400);
      expect(res.body.type).toContain('validation-error');
    });

    it('should reject invalid type', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '50.00', type: 'transfer', category: 'Food', date: '2026-04-01' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '50.00', type: 'expense', category: 'Food', date: '04-01-2026' });

      expect(res.status).toBe(400);
    });

    it('should return RFC 9457 error for 404', async () => {
      const { token } = await registerAdmin();

      const res = await request(app)
        .get('/api/v1/transactions/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status', 404);
      expect(res.body).toHaveProperty('detail');
    });
  });
});
