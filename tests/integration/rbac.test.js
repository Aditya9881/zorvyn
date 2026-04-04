/**
 * Integration Tests: RBAC & Least Privilege Verification
 *
 * These are the CRITICAL PoLP tests from the implementation plan.
 * Each test creates a user with a specific role, obtains tokens,
 * and verifies permission enforcement against protected endpoints.
 *
 * LP1:  Viewer can read transactions              → 200
 * LP2:  Viewer CANNOT create transaction           → 403
 * LP3:  Viewer CANNOT delete transaction           → 403
 * LP4:  Viewer CANNOT access analytics             → 403
 * LP5:  Viewer CANNOT manage users                 → 403
 * LP6:  Analyst can read transactions              → 200
 * LP7:  Analyst can read analytics                 → 200
 * LP8:  Analyst CANNOT create transaction          → 403
 * LP9:  Analyst CANNOT manage users                → 403
 * LP10: Admin can create transaction               → 201
 * LP11: Admin can manage users                     → 200
 * LP12: Unauthenticated request is rejected        → 401
 * LP13: Expired token is rejected                  → 401
 * LP14: Deactivated user is rejected               → 401
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';
import config from '../../src/config/index.js';

describe('RBAC — Least Privilege Enforcement', () => {
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

  /**
   * Helper: Register a user and return their access token.
   * By default, users get the Viewer role.
   */
  async function registerUser(name, email, password = 'SecureP@ss123') {
    const res = await request(app).post('/api/v1/auth/register').send({
      name,
      email,
      password,
    });
    return {
      accessToken: res.body.data.accessToken,
      user: res.body.data.user,
    };
  }

  /**
   * Helper: Upgrade a user to a specific role by directly
   * manipulating the DB and re-logging in to get fresh tokens.
   */
  async function registerWithRole(name, email, roleName) {
    const { user } = await registerUser(name, email);

    if (roleName !== 'Viewer') {
      const role = db
        .prepare('SELECT id FROM roles WHERE name = ?')
        .get(roleName);
      db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(
        user.id,
        role.id
      );
    }

    // Re-login to get tokens with updated permissions
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'SecureP@ss123',
    });

    return {
      accessToken: loginRes.body.data.accessToken,
      user: loginRes.body.data.user,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEWER TESTS (LP1–LP5)
  // ═══════════════════════════════════════════════════════════════

  describe('Viewer Role', () => {
    let viewerToken;

    beforeEach(async () => {
      const result = await registerUser('Viewer User', 'viewer@zorvyn.com');
      viewerToken = result.accessToken;
    });

    // LP1: Viewer can read transactions → 200
    it('LP1: Viewer can read transactions', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    // LP2: Viewer CANNOT create transaction → 403
    it('LP2: Viewer CANNOT create transaction', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ amount: 5000, type: 'expense' });

      expect(res.status).toBe(403);
      expect(res.body.type).toContain('authorization-error');
      expect(res.body.detail).toContain('create_transaction');
    });

    // LP3: Viewer CANNOT delete transaction → 403
    it('LP3: Viewer CANNOT delete transaction', async () => {
      const res = await request(app)
        .delete('/api/v1/transactions/1')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('delete_transaction');
    });

    // LP4: Viewer CANNOT access analytics → 403
    it('LP4: Viewer CANNOT access analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('read_analytics');
    });

    // LP5: Viewer CANNOT manage users → 403
    it('LP5: Viewer CANNOT manage users', async () => {
      const res = await request(app)
        .post('/api/v1/users/1/roles')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'Admin' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('manage_users');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ANALYST TESTS (LP6–LP9)
  // ═══════════════════════════════════════════════════════════════

  describe('Analyst Role', () => {
    let analystToken;

    beforeEach(async () => {
      const result = await registerWithRole(
        'Analyst User',
        'analyst@zorvyn.com',
        'Analyst'
      );
      analystToken = result.accessToken;
    });

    // LP6: Analyst can read transactions → 200
    it('LP6: Analyst can read transactions', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
    });

    // LP7: Analyst can read analytics → 200
    it('LP7: Analyst can read analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
    });

    // LP8: Analyst CANNOT create transaction → 403
    it('LP8: Analyst CANNOT create transaction', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ amount: 5000, type: 'expense' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('create_transaction');
    });

    // LP9: Analyst CANNOT manage users → 403
    it('LP9: Analyst CANNOT manage users', async () => {
      const res = await request(app)
        .post('/api/v1/users/1/roles')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ role: 'Admin' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('manage_users');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADMIN TESTS (LP10–LP11)
  // ═══════════════════════════════════════════════════════════════

  describe('Admin Role', () => {
    let adminToken;

    beforeEach(async () => {
      const result = await registerWithRole(
        'Admin User',
        'admin@zorvyn.com',
        'Admin'
      );
      adminToken = result.accessToken;
    });

    // LP10: Admin can create transaction → 201
    it('LP10: Admin can create transaction', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: '50.00', type: 'expense', category: 'Food', date: '2026-04-01' });

      expect(res.status).toBe(201);
    });

    // LP11: Admin can manage users → 200
    it('LP11: Admin can manage users', async () => {
      const res = await request(app)
        .post('/api/v1/users/1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Analyst' });

      expect(res.status).toBe(200);
    });

    it('Admin can access analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('Admin can delete transaction', async () => {
      // Create a transaction first so we have something to delete
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: '25.00', type: 'expense', category: 'Test', date: '2026-04-01' });

      const txId = createRes.body.data.transaction.id;

      const res = await request(app)
        .delete(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION EDGE CASES (LP12–LP14)
  // ═══════════════════════════════════════════════════════════════

  describe('Authentication Edge Cases', () => {
    // LP12: Unauthenticated request → 401
    it('LP12: Unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/v1/transactions');

      expect(res.status).toBe(401);
      expect(res.body.type).toContain('authentication-error');
    });

    // LP13: Expired token → 401
    it('LP13: Expired token is rejected', async () => {
      // Create a token that's already expired
      const expiredToken = jwt.sign(
        {
          sub: 1,
          roles: ['Viewer'],
          permissions: ['read_transactions'],
          jti: 'test-expired-jti',
          type: 'access',
        },
        config.jwt.accessTokenSecret,
        { expiresIn: '0s' } // Immediately expired
      );

      // Small delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.detail).toContain('expired');
    });

    // LP14: Deactivated user → 401
    it('LP14: Deactivated user is rejected on login', async () => {
      // Register a user
      const { user } = await registerUser('Inactive User', 'inactive@zorvyn.com');

      // Deactivate directly in DB
      db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.id);

      // Attempt login
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'inactive@zorvyn.com',
        password: 'SecureP@ss123',
      });

      expect(res.status).toBe(401);
      expect(res.body.detail).toContain('deactivated');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RFC 9457 ERROR FORMAT VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe('RFC 9457 Error Format', () => {
    it('should return RFC 9457 Problem Details for 401', async () => {
      const res = await request(app).get('/api/v1/transactions');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status', 401);
      expect(res.body).toHaveProperty('detail');
      expect(res.body.type).toMatch(/^https:\/\//);
    });

    it('should return RFC 9457 Problem Details for 403', async () => {
      const { accessToken } = await registerUser('RFC User', 'rfc@zorvyn.com');

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 100 });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status', 403);
      expect(res.body).toHaveProperty('detail');
      expect(res.body).toHaveProperty('instance');
    });
  });
});
