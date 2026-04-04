/**
 * Integration Tests: Authentication Endpoints
 *
 * Tests the full HTTP flow through Express using supertest.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Auth Endpoints', () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return access token', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecureP@ss123',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.name).toBe('Test User');
      expect(res.body.data.user.roles).toEqual(['Viewer']);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should set refreshToken as HttpOnly cookie', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Cookie User',
        email: 'cookie@example.com',
        password: 'SecureP@ss123',
      });

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.type).toContain('validation-error');
    });

    it('should reject registration with short password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test',
        email: 'test@example.com',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('at least 8 characters');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'SecureP@ss123',
      });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'SecureP@ss123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should reject incorrect password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.type).toContain('authentication-error');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and invalidate token', async () => {
      const registerRes = await request(app).post('/api/v1/auth/register').send({
        name: 'Logout User',
        email: 'logout@example.com',
        password: 'SecureP@ss123',
      });

      const token = registerRes.body.data.accessToken;

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Token should now be revoked
      const protectedRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedRes.status).toBe(401);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 health check', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
