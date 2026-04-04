/**
 * Integration Tests: Budget Management
 *
 * Tests budget CRUD with remaining-budget calculation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Budget Management', () => {
  let app;
  let db;
  let token;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    // Register with Admin role (has create_transaction + read_transactions)
    await request(app).post('/api/v1/auth/register').send({
      name: 'Budget User', email: 'budget@test.com', password: 'SecureP@ss123',
    });
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, role.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'budget@test.com', password: 'SecureP@ss123',
    });
    token = login.body.data.accessToken;
  });

  afterEach(() => {
    db.close();
  });

  it('set budget returns dollar string limit', async () => {
    const res = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Groceries', limit: '500.00', yearMonth: '2026-04' });

    expect(res.status).toBe(200);
    expect(res.body.data.budget.limit).toBe('500.00');
    expect(res.body.data.budget.category).toBe('Groceries');
    expect(res.body.data.budget.yearMonth).toBe('2026-04');
  });

  it('get budgets with remaining = limit - actual spend', async () => {
    // Set budget
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Groceries', limit: '500.00', yearMonth: '2026-04' });

    // Create expenses in that category/month
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '150.00', type: 'expense', category: 'Groceries', date: '2026-04-05' });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '100.00', type: 'expense', category: 'Groceries', date: '2026-04-15' });

    // Get budgets — should show remaining
    const res = await request(app)
      .get('/api/v1/budgets?yearMonth=2026-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const grocery = res.body.data.budgets.find((b) => b.category === 'Groceries');
    expect(grocery.limit).toBe('500.00');
    expect(grocery.spent).toBe('250.00');
    expect(grocery.remaining).toBe('250.00');
  });

  it('overspending shows negative remaining', async () => {
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Food', limit: '100.00', yearMonth: '2026-04' });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '150.00', type: 'expense', category: 'Food', date: '2026-04-10' });

    const res = await request(app)
      .get('/api/v1/budgets?yearMonth=2026-04')
      .set('Authorization', `Bearer ${token}`);

    const food = res.body.data.budgets.find((b) => b.category === 'Food');
    expect(food.remaining).toBe('-50.00');
  });

  it('upsert updates existing budget', async () => {
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Rent', limit: '1000.00', yearMonth: '2026-04' });

    const res = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Rent', limit: '1200.00', yearMonth: '2026-04' });

    expect(res.status).toBe(200);
    expect(res.body.data.budget.limit).toBe('1200.00');

    // Only 1 budget record should exist
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM budgets').get();
    expect(count.cnt).toBe(1);
  });

  it('delete removes budget', async () => {
    const createRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Travel', limit: '300.00', yearMonth: '2026-04' });

    const budgetId = createRes.body.data.budget.id;

    const res = await request(app)
      .delete(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Budget is truly deleted (not soft-deleted)
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM budgets').get();
    expect(count.cnt).toBe(0);
  });

  it('category is normalized to Title Case', async () => {
    const res = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'fast food', limit: '200.00', yearMonth: '2026-04' });

    expect(res.body.data.budget.category).toBe('Fast Food');
  });
});
