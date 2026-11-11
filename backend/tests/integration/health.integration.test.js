const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../src/app');
const { checkConnection, closePool } = require('../../src/database');

describe('Integration Tests: Live Supabase Database & Health Endpoint', () => {
  after(async () => {
    await closePool();
  });

  test('Live database ping (SELECT 1 AS alive) succeeds against Supabase Pooler', async () => {
    const status = await checkConnection();
    assert.strictEqual(status.connected, true, `DB connection failed: ${status.error}`);
    assert.strictEqual(status.alive, true);
  });

  test('GET /api/health returns HTTP 200 with live connected database status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.database, 'connected');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(res.body.timestamp);
  });
});
