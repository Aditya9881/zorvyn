/**
 * Performance Tests: Load Benchmarking
 *
 * Verifies response times stay under 100ms for summary queries
 * under concurrent load. Seeds 1000 transactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Performance Benchmarks', () => {
  let app;
  let db;
  let token;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    // Register with Admin + Analyst role
    await request(app).post('/api/v1/auth/register').send({
      name: 'Perf User', email: 'perf@test.com', password: 'SecureP@ss123',
    });
    const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    const analystRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Analyst');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, adminRole.id);
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, analystRole.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'perf@test.com', password: 'SecureP@ss123',
    });
    token = login.body.data.accessToken;

    // Seed 1000 transactions directly via SQL for speed
    const stmt = db.prepare(
      `INSERT INTO transactions (user_id, type, category, amount, note, date)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const categories = ['Groceries', 'Utilities', 'Rent', 'Entertainment', 'Travel'];
    const types = ['income', 'expense'];

    const insert = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const type = types[i % 2];
        const category = categories[i % categories.length];
        const amount = Math.floor(Math.random() * 100000) + 100; // 1.00 - 1001.00
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');

        stmt.run(1, type, category, amount, `Transaction ${i}`, `2026-${month}-${day}`);
      }
    });
    insert();
  });

  afterEach(() => {
    db.close();
  });

  it('summary query completes under 100ms with 1000 records', async () => {
    const start = performance.now();

    const res = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${token}`);

    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.data.summary.transactionCount).toBe(1000);
    expect(elapsed).toBeLessThan(100);
  });

  it('trends query completes under 100ms with 1000 records', async () => {
    const start = performance.now();

    const res = await request(app)
      .get('/api/v1/analytics/trends?year=2026')
      .set('Authorization', `Bearer ${token}`);

    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.data.trends).toHaveLength(12);
    expect(elapsed).toBeLessThan(100);
  });

  it('10 concurrent summary requests all complete under 100ms', async () => {
    const start = performance.now();

    const promises = Array.from({ length: 10 }, () =>
      request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${token}`)
    );

    const results = await Promise.all(promises);
    const totalElapsed = performance.now() - start;

    // All should succeed
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    // Total time for 10 concurrent requests under 100ms
    expect(totalElapsed).toBeLessThan(100);
  });
});
