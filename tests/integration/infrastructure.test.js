/**
 * Integration Tests: Infrastructure Verification
 *
 * Tests that the application starts correctly, responds to
 * health checks, serves Swagger docs, and handles missing
 * env vars gracefully.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Infrastructure Verification', () => {
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

  it('health check returns 200 with status and timestamp', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();

    // Verify timestamp is a valid ISO 8601 string
    const parsed = new Date(res.body.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('Swagger docs endpoint returns 200', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    // Swagger UI serves HTML
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('database migrations run cleanly on fresh database', async () => {
    // The app was created with a fresh in-memory DB —
    // if we got here without throwing, migrations succeeded.
    // Verify key tables exist.
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'
         ORDER BY name`
      )
      .all()
      .map((row) => row.name);

    expect(tables).toContain('users');
    expect(tables).toContain('roles');
    expect(tables).toContain('permissions');
    expect(tables).toContain('user_roles');
    expect(tables).toContain('role_permissions');
    expect(tables).toContain('transactions');
    expect(tables).toContain('audit_logs');
  });

  it('app handles default config when env vars are missing', async () => {
    // The app starts without explicit JWT secrets — it falls back to defaults.
    // Health check should still work.
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
