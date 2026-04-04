/**
 * Integration Tests: AI Financial Insights
 *
 * Tests GET /analytics/ai-insights endpoint.
 * Verifies that actionable financial tips are generated
 * based on the user's spending patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/index.js';
import { clearRevokedTokens } from '../../src/infrastructure/security/tokenService.js';

describe('AI Financial Insights', () => {
  let app;
  let db;
  let token;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    clearRevokedTokens();
    app = createApp(db);

    // Register with Analyst + Admin role
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
    token = login.body.data.accessToken;
  });

  afterEach(() => {
    db.close();
  });

  it('returns insights array with period and summary', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.insights)).toBe(true);
    expect(res.body.data.period).toBeDefined();
    expect(res.body.data.period.days).toBe(30);
    expect(res.body.data.summary).toBeDefined();
  });

  it('generates "no activity" insight when no transactions exist', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const noActivity = res.body.data.insights.find((i) => i.title === 'No Recent Activity');
    expect(noActivity).toBeDefined();
    expect(noActivity.type).toBe('info');
  });

  it('generates high spend-to-income ratio warning', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Income: $1000, Expense: $950 (95% ratio)
    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '1000.00', type: 'income', category: 'Salary', date: today });

    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '950.00', type: 'expense', category: 'Rent', date: today });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const warning = res.body.data.insights.find((i) => i.title === 'High Spend-to-Income Ratio');
    expect(warning).toBeDefined();
    expect(warning.type).toBe('warning');
    expect(warning.priority).toBe('high');
  });

  it('generates strong savings rate positive insight', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Income: $5000, Expense: $1000 (20% ratio = 80% savings)
    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '5000.00', type: 'income', category: 'Salary', date: today });

    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '1000.00', type: 'expense', category: 'Rent', date: today });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const positive = res.body.data.insights.find((i) => i.title === 'Strong Savings Rate');
    expect(positive).toBeDefined();
    expect(positive.type).toBe('positive');
  });

  it('detects budget overrun and generates warning', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yearMonth = today.slice(0, 7);

    // Set budget
    await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Groceries', limit: '200.00', yearMonth });

    // Exceed budget
    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '300.00', type: 'expense', category: 'Groceries', date: today });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const overrun = res.body.data.insights.find((i) => i.title === 'Groceries Budget Exceeded');
    expect(overrun).toBeDefined();
    expect(overrun.type).toBe('warning');
    expect(overrun.priority).toBe('high');
  });

  it('suggests setting budgets when none exist', async () => {
    const today = new Date().toISOString().slice(0, 10);

    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '50.00', type: 'expense', category: 'Food', date: today });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const suggestion = res.body.data.insights.find((i) => i.title === 'Set Up Budgets');
    expect(suggestion).toBeDefined();
    expect(suggestion.type).toBe('suggestion');
  });

  it('insights are sorted by priority (high → medium → low)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yearMonth = today.slice(0, 7);

    // Create scenario with multiple insight triggers
    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '1000.00', type: 'income', category: 'Salary', date: today });

    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '950.00', type: 'expense', category: 'Rent', date: today });

    await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Rent', limit: '500.00', yearMonth });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    const priorities = res.body.data.insights.map((i) => i.priority);
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    for (let i = 1; i < priorities.length; i++) {
      expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(priorityOrder[priorities[i - 1]]);
    }
  });

  it('Viewer gets 403 on ai-insights', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Viewer', email: 'viewer@test.com', password: 'SecureP@ss123',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'viewer@test.com', password: 'SecureP@ss123',
    });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('summary includes dollar string amounts', async () => {
    const today = new Date().toISOString().slice(0, 10);

    await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '250.50', type: 'expense', category: 'Shopping', date: today });

    const res = await request(app)
      .get('/api/v1/analytics/ai-insights')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.summary.totalExpense).toBe('250.50');
    expect(res.body.data.summary.totalIncome).toBe('0.00');
  });
});
