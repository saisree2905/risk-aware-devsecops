const { test, describe, mock } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { maskConnectionString } = require('../../src/config/env');
const { sanitizeDbError } = require('../../src/database');
const dbModule = require('../../src/database');
const app = require('../../src/app');

describe('Unit Tests: Configuration & Sanitization', () => {
  test('maskConnectionString masks username and password safely', () => {
    const raw = 'postgresql://myuser:secretpassword@aws-1.pooler.supabase.com:5432/postgres';
    const masked = maskConnectionString(raw);
    assert.strictEqual(masked.includes('secretpassword'), false);
    assert.strictEqual(masked.includes('myuser'), false);
    assert.strictEqual(masked, 'postgresql://***:***@aws-1.pooler.supabase.com:5432/postgres');
  });

  test('maskConnectionString handles empty or invalid strings gracefully', () => {
    assert.strictEqual(maskConnectionString(''), '');
    assert.strictEqual(maskConnectionString('not-a-valid-url'), 'postgresql://***:***@masked-host/db');
  });

  test('sanitizeDbError strips out raw postgres connection URIs and credentials', () => {
    const rawError = new Error('Connection failed to postgresql://admin:superSecret123@db.internal:5432/mydb timeout');
    const sanitized = sanitizeDbError(rawError);
    assert.strictEqual(sanitized.message.includes('superSecret123'), false);
    assert.strictEqual(sanitized.message.includes('admin'), false);
    assert.strictEqual(sanitized.message.includes('postgresql://***:***@masked-host/db'), true);
  });
});

describe('Unit Tests: Health API Endpoint Behavior', () => {
  test('GET / returns framework metadata', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'running');
    assert.strictEqual(res.body.name, 'Risk-Aware DevSecOps Framework API');
  });

  test('GET /api/health returns HTTP 503 when database is disconnected', async () => {
    // Mock checkConnection to simulate offline database
    const originalCheck = dbModule.checkConnection;
    dbModule.checkConnection = async () => ({ connected: false, error: 'Simulated connection failure' });

    try {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.status, 'error');
      assert.strictEqual(res.body.database, 'disconnected');
      assert.strictEqual(res.body.message, 'Database service is currently unreachable');
    } finally {
      dbModule.checkConnection = originalCheck;
    }
  });

  test('GET /api/health returns HTTP 200 when database is connected', async () => {
    // Mock checkConnection to simulate online database
    const originalCheck = dbModule.checkConnection;
    dbModule.checkConnection = async () => ({ connected: true, alive: true });

    try {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.database, 'connected');
      assert.ok(typeof res.body.uptime === 'number');
      assert.ok(res.body.timestamp);
    } finally {
      dbModule.checkConnection = originalCheck;
    }
  });
});
