/**
 * Integration Tests: Audit Log API
 *
 * Tests Admin-only audit log querying.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Audit Log API', () => {
  let app;
  let db;
  let adminToken;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    await request(app).post('/api/v1/auth/register').send({
      name: 'Admin', email: 'admin@test.com', password: 'SecureP@ss123',
    });
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get('Admin');
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(1, role.id);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com', password: 'SecureP@ss123',
    });
    adminToken = login.body.data.accessToken;

    // Seed some audit log entries directly
    const auditRepo = app._auditLogRepository;
    auditRepo.create({
      actorId: 1, actorEmail: 'admin@test.com',
      action: 'CREATE', resourceType: 'transaction', resourceId: 1,
      metadata: { amount: '100.00' }, ipAddress: '127.0.0.1',
    });
    auditRepo.create({
      actorId: 1, actorEmail: 'admin@test.com',
      action: 'DEACTIVATE', resourceType: 'user', resourceId: 2,
      metadata: {}, ipAddress: '127.0.0.1',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('Admin can list all audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBe(2);
    expect(res.body.data.count).toBe(2);
  });

  it('audit logs filterable by resourceType', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?resourceType=user')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBe(1);
    expect(res.body.data.logs[0].action).toBe('DEACTIVATE');
  });

  it('non-admin gets 403', async () => {
    // Register viewer
    await request(app).post('/api/v1/auth/register').send({
      name: 'Viewer', email: 'viewer@test.com', password: 'SecureP@ss123',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'viewer@test.com', password: 'SecureP@ss123',
    });

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(403);
  });
});
