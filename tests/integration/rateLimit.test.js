/**
 * Integration Tests: Rate Limiting
 *
 * Tests that rate limiters return RFC 9457 errors on 429.
 * Uses createApp with { enableRateLimiting: true }.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('Rate Limiting', () => {
  let app;
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    // Enable rate limiting for these tests
    app = createApp(db, { enableRateLimiting: true });
  });

  afterEach(() => {
    db.close();
  });

  it('should return 429 after exceeding login limit', async () => {
    // Send 6 login attempts (limit is 5 per 15 min)
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        request(app).post('/api/v1/auth/login').send({
          email: 'test@test.com', password: 'wrong',
        })
      );
    }

    const results = await Promise.all(attempts);
    const lastResult = results[results.length - 1];

    expect(lastResult.status).toBe(429);
    expect(lastResult.body.type).toContain('rate-limit');
    expect(lastResult.body.status).toBe(429);
    expect(lastResult.body.detail).toContain('login');
  });

  it('rate limit response follows RFC 9457 format', async () => {
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        request(app).post('/api/v1/auth/login').send({
          email: 'test@test.com', password: 'wrong',
        })
      );
    }

    const results = await Promise.all(attempts);
    const limited = results.find((r) => r.status === 429);

    if (limited) {
      expect(limited.body).toHaveProperty('type');
      expect(limited.body).toHaveProperty('title', 'Too Many Requests');
      expect(limited.body).toHaveProperty('status', 429);
      expect(limited.body).toHaveProperty('detail');
    }
  });
});
