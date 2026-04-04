/**
 * Integration Tests: CSV Export
 *
 * Tests transaction CSV export with filters, headers, and streaming.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('CSV Export', () => {
  let app;
  let db;
  let token;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    await request(app).post('/api/v1/auth/register').send({
      name: 'Export User', email: 'export@test.com', password: 'SecureP@ss123',
    });
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, role.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'export@test.com', password: 'SecureP@ss123',
    });
    token = login.body.data.accessToken;

    // Seed transactions
    const txs = [
      { amount: '100.00', type: 'income',  category: 'Salary',    date: '2026-01-15' },
      { amount: '25.50',  type: 'expense', category: 'Groceries', date: '2026-01-20' },
      { amount: '200.00', type: 'income',  category: 'Freelance', date: '2026-02-10' },
    ];
    for (const tx of txs) {
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(tx);
    }
  });

  afterEach(() => {
    db.close();
  });

  it('export returns CSV with correct headers', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.csv');

    const lines = res.text.split('\n').filter((l) => l.trim());
    expect(lines[0]).toBe('Date,Type,Category,Amount,Note,Created At');
    expect(lines.length).toBe(4); // header + 3 records
  });

  it('export contains correct dollar amounts', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/export')
      .set('Authorization', `Bearer ${token}`);

    const lines = res.text.split('\n').filter((l) => l.trim());
    // Records are ordered by date ASC
    expect(lines[1]).toContain('100.00');
    expect(lines[1]).toContain('income');
    expect(lines[2]).toContain('25.50');
    expect(lines[2]).toContain('expense');
  });

  it('export respects type filter', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/export?type=expense')
      .set('Authorization', `Bearer ${token}`);

    const lines = res.text.split('\n').filter((l) => l.trim());
    expect(lines.length).toBe(2); // header + 1 expense
    expect(lines[1]).toContain('Groceries');
  });

  it('export respects date range filter', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/export?startDate=2026-02-01&endDate=2026-02-28')
      .set('Authorization', `Bearer ${token}`);

    const lines = res.text.split('\n').filter((l) => l.trim());
    expect(lines.length).toBe(2); // header + 1 February record
    expect(lines[1]).toContain('Freelance');
  });
});
