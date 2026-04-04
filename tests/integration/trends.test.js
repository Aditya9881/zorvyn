/**
 * Integration Tests: Trend Analytics
 *
 * Tests GET /analytics/trends returns 12-month arrays
 * with income/expense as dollar strings, suitable for line charts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Trend Analytics', () => {
  let app;
  let db;
  let analystToken;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    // Register user with Analyst role (has read_analytics + create_transaction)
    await request(app).post('/api/v1/auth/register').send({
      name: 'Analyst', email: 'analyst@test.com', password: 'SecureP@ss123',
    });
    const analystRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Analyst');
    const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, analystRole.id);
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, adminRole.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'analyst@test.com', password: 'SecureP@ss123',
    });
    analystToken = login.body.data.accessToken;

    // Seed transactions across multiple months
    const transactions = [
      { amount: '1000.00', type: 'income',  category: 'Salary',    date: '2026-01-15' },
      { amount: '200.00',  type: 'expense', category: 'Groceries', date: '2026-01-20' },
      { amount: '1000.00', type: 'income',  category: 'Salary',    date: '2026-02-15' },
      { amount: '150.00',  type: 'expense', category: 'Utilities', date: '2026-02-25' },
      { amount: '500.00',  type: 'income',  category: 'Freelance', date: '2026-04-10' },
      { amount: '75.50',   type: 'expense', category: 'Food',      date: '2026-04-12' },
    ];

    for (const tx of transactions) {
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(tx);
    }
  });

  afterEach(() => {
    db.close();
  });

  it('returns 12 months for the requested year', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trends).toHaveLength(12);
    expect(res.body.data.year).toBe('2026');
  });

  it('months with data have correct income/expense dollar strings', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${analystToken}`);

    const jan = res.body.data.trends.find((t) => t.month === '2026-01');
    expect(jan.income).toBe('1000.00');
    expect(jan.expense).toBe('200.00');
    expect(jan.transactionCount).toBe(2);

    const feb = res.body.data.trends.find((t) => t.month === '2026-02');
    expect(feb.income).toBe('1000.00');
    expect(feb.expense).toBe('150.00');

    const apr = res.body.data.trends.find((t) => t.month === '2026-04');
    expect(apr.income).toBe('500.00');
    expect(apr.expense).toBe('75.50');
  });

  it('empty months have "0.00" for income and expense', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${analystToken}`);

    const mar = res.body.data.trends.find((t) => t.month === '2026-03');
    expect(mar.income).toBe('0.00');
    expect(mar.expense).toBe('0.00');
    expect(mar.transactionCount).toBe(0);

    const dec = res.body.data.trends.find((t) => t.month === '2026-12');
    expect(dec.income).toBe('0.00');
    expect(dec.expense).toBe('0.00');
    expect(dec.transactionCount).toBe(0);
  });

  it('year filter scopes correctly (empty year returns zero)', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2025')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trends).toHaveLength(12);

    // All months should be zero
    for (const month of res.body.data.trends) {
      expect(month.income).toBe('0.00');
      expect(month.expense).toBe('0.00');
      expect(month.transactionCount).toBe(0);
    }
  });

  it('Viewer gets 403 on trends endpoint', async () => {
    // Register viewer
    await request(app).post('/api/v1/auth/register').send({
      name: 'Viewer', email: 'viewer@test.com', password: 'SecureP@ss123',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'viewer@test.com', password: 'SecureP@ss123',
    });
    const viewerToken = login.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('months are ordered chronologically (01 → 12)', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${analystToken}`);

    const months = res.body.data.trends.map((t) => t.month);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');

    // Verify ordering
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
  });
});
