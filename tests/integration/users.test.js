/**
 * Integration Tests: User Management Endpoints
 *
 * Tests Admin-only user management with token revocation on deactivation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('User Management Endpoints', () => {
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

  // ═══════════════════════════════════════════════════════════════
  // ADMIN CAN MANAGE USERS
  // ═══════════════════════════════════════════════════════════════

  describe('Admin User Management', () => {
    let adminToken;

    beforeEach(async () => {
      const admin = await registerWithRole('Admin', 'admin@test.com', 'Admin');
      adminToken = admin.token;
    });

    it('Admin can list all users', async () => {
      // Register another user
      await request(app).post('/api/v1/auth/register').send({
        name: 'User B', email: 'userb@test.com', password: 'SecureP@ss123',
      });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.users[0]).toHaveProperty('roles');
    });

    it('Admin can get user by ID with roles and permissions', async () => {
      const viewer = await registerWithRole('Viewer', 'viewer@test.com', 'Viewer');

      const res = await request(app)
        .get(`/api/v1/users/${viewer.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toContain('Viewer');
      expect(res.body.data.user.permissions).toContain('read_transactions');
    });

    it('Admin can assign role to user', async () => {
      const viewer = await registerWithRole('Viewer', 'viewer2@test.com', 'Viewer');

      const res = await request(app)
        .post(`/api/v1/users/${viewer.userId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Analyst' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toContain('Analyst');
      expect(res.body.data.user.roles).toContain('Viewer');
    });

    it('Admin can remove role from user', async () => {
      const analyst = await registerWithRole('Analyst', 'analyst@test.com', 'Analyst');

      const res = await request(app)
        .delete(`/api/v1/users/${analyst.userId}/roles/Analyst`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).not.toContain('Analyst');
    });

    it('Admin cannot assign duplicate role', async () => {
      const viewer = await registerWithRole('Viewer', 'viewer3@test.com', 'Viewer');

      const res = await request(app)
        .post(`/api/v1/users/${viewer.userId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Viewer' });

      expect(res.status).toBe(409);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/v1/users/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.type).toContain('not-found');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DEACTIVATION + TOKEN REVOCATION
  // ═══════════════════════════════════════════════════════════════

  describe('Deactivation & Token Revocation', () => {
    it('deactivated user\'s token is immediately invalid', async () => {
      const admin = await registerWithRole('Admin', 'admin2@test.com', 'Admin');
      const viewer = await registerWithRole('Target User', 'target@test.com', 'Viewer');

      // Viewer's token works before deactivation
      const beforeRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(beforeRes.status).toBe(200);

      // Admin deactivates the viewer
      const deactivateRes = await request(app)
        .post(`/api/v1/users/${viewer.userId}/deactivate`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.data.user.isActive).toBe(0);
      expect(deactivateRes.body.data.tokensRevoked).toBeGreaterThanOrEqual(1);

      // Viewer's token is NOW INVALID (revoked)
      const afterRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(afterRes.status).toBe(401);
    });

    it('deactivated user cannot login', async () => {
      const admin = await registerWithRole('Admin', 'admin3@test.com', 'Admin');
      await registerWithRole('Victim', 'victim@test.com', 'Viewer');

      // Admin deactivates
      await request(app)
        .post(`/api/v1/users/2/deactivate`)
        .set('Authorization', `Bearer ${admin.token}`);

      // Victim cannot login
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'victim@test.com', password: 'SecureP@ss123',
      });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.detail).toContain('deactivated');
    });

    it('Admin can reactivate user, who can then login again', async () => {
      const admin = await registerWithRole('Admin', 'admin4@test.com', 'Admin');
      const user = await registerWithRole('Reactivate', 'reactivate@test.com', 'Viewer');

      // Deactivate
      await request(app)
        .post(`/api/v1/users/${user.userId}/deactivate`)
        .set('Authorization', `Bearer ${admin.token}`);

      // Reactivate
      const reactivateRes = await request(app)
        .post(`/api/v1/users/${user.userId}/activate`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.user.isActive).toBe(1);

      // User can login again
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'reactivate@test.com', password: 'SecureP@ss123',
      });
      expect(loginRes.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RBAC ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════

  describe('RBAC on User Management', () => {
    it('Viewer gets 403 on user management routes', async () => {
      const viewer = await registerWithRole('Viewer', 'viewer4@test.com', 'Viewer');

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${viewer.token}`);

      expect(res.status).toBe(403);
    });

    it('Analyst gets 403 on user management routes', async () => {
      const analyst = await registerWithRole('Analyst', 'analyst2@test.com', 'Analyst');

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${analyst.token}`);

      expect(res.status).toBe(403);
    });
  });
});
