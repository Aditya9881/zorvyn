/**
 * Integration Tests: Idempotency
 *
 * Tests that duplicate POST /transactions with the same Idempotency-Key
 * do not create duplicate records.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Idempotency', () => {
  let app;
  let db;
  let token;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    // Register and login a user with create_transaction permission
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User', email: 'test@test.com', password: 'SecureP@ss123',
    });
    // Assign Admin role for create_transaction
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, role.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'test@test.com', password: 'SecureP@ss123',
    });
    token = login.body.data.accessToken;
  });

  afterEach(() => {
    db.close();
  });

  it('duplicate POST with same Idempotency-Key creates only 1 record', async () => {
    const key = 'unique-key-001';
    const body = { amount: '50.00', type: 'expense', category: 'Food', date: '2026-04-01' };

    const res1 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(res1.status).toBe(201);
    const txId = res1.body.data.transaction.id;

    // Replay with same key
    const res2 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

    // Should return the cached response, not create a new record
    expect(res2.status).toBe(201);
    expect(res2.body.data.transaction.id).toBe(txId);

    // Verify only 1 record in DB
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM transactions WHERE deleted_at IS NULL').get();
    expect(count.cnt).toBe(1);
  });

  it('response body is identical on replay', async () => {
    const key = 'unique-key-002';
    const body = { amount: '99.99', type: 'income', category: 'Salary', date: '2026-04-01' };

    const res1 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

    const res2 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(res1.body).toEqual(res2.body);
  });

  it('different users with same key create separate records', async () => {
    const key = 'shared-key';
    const body = { amount: '25.00', type: 'expense', category: 'Travel', date: '2026-04-01' };

    // User 1 creates
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

    // Register user 2
    await request(app).post('/api/v1/auth/register').send({
      name: 'User Two', email: 'user2@test.com', password: 'SecureP@ss123',
    });
    const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(2, adminRole.id);

    const login2 = await request(app).post('/api/v1/auth/login').send({
      email: 'user2@test.com', password: 'SecureP@ss123',
    });
    const token2 = login2.body.data.accessToken;

    // User 2 creates with same key — should NOT return cached response
    const res2 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token2}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(res2.status).toBe(201);

    // 2 separate records total
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM transactions WHERE deleted_at IS NULL').get();
    expect(count.cnt).toBe(2);
  });

  it('missing Idempotency-Key still creates transaction normally', async () => {
    const body = { amount: '10.00', type: 'expense', category: 'Misc', date: '2026-04-01' };

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.data.transaction.amount).toBe('10.00');
  });

  it('different keys create separate records', async () => {
    const body = { amount: '30.00', type: 'expense', category: 'Food', date: '2026-04-01' };

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-A')
      .send(body);

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-B')
      .send(body);

    const count = db.prepare('SELECT COUNT(*) AS cnt FROM transactions WHERE deleted_at IS NULL').get();
    expect(count.cnt).toBe(2);
  });
});
