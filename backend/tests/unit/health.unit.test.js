const { test, describe, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { config, validateConfig, maskConnectionString } = require('../../src/config/env');
const { sanitizeDbError, getSslConfig } = require('../../src/database');
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

  test('validateConfig enforces required API_KEY in production mode with zero fallback', () => {
    const originalEnv = config.env;
    const originalApiKey = config.apiKey;
    const originalSslReject = config.sslRejectUnauthorized;

    try {
      config.env = 'production';
      config.apiKey = '';
      config.sslRejectUnauthorized = true;

      assert.throws(
        () => validateConfig(),
        /Missing required configuration: API_KEY must be set in production mode/
      );

      config.apiKey = 'prod_secret_key_12345';
      assert.doesNotThrow(() => validateConfig());
    } finally {
      config.env = originalEnv;
      config.apiKey = originalApiKey;
      config.sslRejectUnauthorized = originalSslReject;
    }
  });

  test('validateConfig throws if DB_SSL_REJECT_UNAUTHORIZED=false in production', () => {
    const originalEnv = config.env;
    const originalApiKey = config.apiKey;
    const originalSslReject = config.sslRejectUnauthorized;

    try {
      config.env = 'production';
      config.apiKey = 'prod_secret_key_12345';
      config.sslRejectUnauthorized = false;

      assert.throws(
        () => validateConfig(),
        /Production security violation: DB_SSL_REJECT_UNAUTHORIZED cannot be set to false in production mode/
      );

      config.sslRejectUnauthorized = true;
      assert.doesNotThrow(() => validateConfig());
    } finally {
      config.env = originalEnv;
      config.apiKey = originalApiKey;
      config.sslRejectUnauthorized = originalSslReject;
    }
  });

  test('getSslConfig defaults to TLS verification enabled (rejectUnauthorized: true)', () => {
    const originalSslReject = config.sslRejectUnauthorized;
    const originalCaCertPath = config.caCertPath;

    try {
      config.sslRejectUnauthorized = true;
      config.caCertPath = '';

      const sslConfig = getSslConfig();
      assert.strictEqual(sslConfig.rejectUnauthorized, true);
    } finally {
      config.sslRejectUnauthorized = originalSslReject;
      config.caCertPath = originalCaCertPath;
    }
  });

  test('getSslConfig loads trusted CA certificate when DB_CA_CERT_PATH is provided', () => {
    const originalCaCertPath = config.caCertPath;
    const tempCaPath = path.resolve(__dirname, '../fixtures/temp-ca.crt');
    fs.writeFileSync(tempCaPath, '-----BEGIN CERTIFICATE-----\nFAKECA\n-----END CERTIFICATE-----');

    try {
      config.caCertPath = tempCaPath;
      const sslConfig = getSslConfig();
      assert.strictEqual(sslConfig.rejectUnauthorized, true);
      assert.ok(sslConfig.ca.includes('FAKECA'));
    } finally {
      config.caCertPath = originalCaCertPath;
      if (fs.existsSync(tempCaPath)) fs.unlinkSync(tempCaPath);
    }
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

  test('GET /api/health/live returns HTTP 200 process vitality without DB query', async () => {
    // Even if DB is down, liveness must return 200
    const originalCheck = dbModule.checkConnection;
    let dbCalled = false;
    dbModule.checkConnection = async () => {
      dbCalled = true;
      return { connected: false, error: 'DB down' };
    };

    try {
      const res = await request(app).get('/api/health/live');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.service, 'alive');
      assert.strictEqual(dbCalled, false, 'Liveness probe must not query the database');
    } finally {
      dbModule.checkConnection = originalCheck;
    }
  });

  test('GET /api/health/ready checks DB and returns 200 when connected and 503 when down', async () => {
    const originalCheck = dbModule.checkConnection;
    try {
      // 1. Ready when connected
      dbModule.checkConnection = async () => ({ connected: true, alive: true });
      const res1 = await request(app).get('/api/health/ready');
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.database, 'connected');

      // 2. Unready when disconnected
      dbModule.checkConnection = async () => ({ connected: false, error: 'DB down' });
      const res2 = await request(app).get('/api/health/ready');
      assert.strictEqual(res2.status, 503);
      assert.strictEqual(res2.body.database, 'disconnected');
    } finally {
      dbModule.checkConnection = originalCheck;
    }
  });
});
