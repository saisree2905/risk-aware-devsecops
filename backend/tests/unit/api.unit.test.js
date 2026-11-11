const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/app');
const { config } = require('../../src/config/env');
const db = require('../../src/database');
const orchestratorService = require('../../src/services/orchestrator.service');

describe('Unit Tests: Scan Ingestion API & Authentication', () => {
  const originalApiKey = config.apiKey;
  const originalQuery = db.query;
  const originalOrchestrateScan = orchestratorService.orchestrateScan;

  beforeEach(() => {
    config.apiKey = 'test_devsecops_key_12345';
  });

  afterEach(() => {
    config.apiKey = originalApiKey;
    db.query = originalQuery;
    orchestratorService.orchestrateScan = originalOrchestrateScan;
  });

  // 1. Missing API Key
  test('POST /api/scans/ingest returns HTTP 401 when x-api-key header is missing', async () => {
    const res = await request(app)
      .post('/api/scans/ingest')
      .send({ commitHash: 'abc1234567', branch: 'main' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.status, 'error');
    assert.ok(res.body.message.includes('Missing x-api-key'));
  });

  // 2. Invalid API Key
  test('POST /api/scans/ingest returns HTTP 401 when x-api-key header is incorrect', async () => {
    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'wrong_key_value')
      .send({ commitHash: 'abc1234567', branch: 'main' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.status, 'error');
    assert.ok(res.body.message.includes('Invalid API key'));
  });

  // 2b. Valid API Key accepted
  test('POST /api/scans/ingest accepts valid x-api-key header and proceeds past authentication', async () => {
    // With missing body fields, passes auth and hits validator (400)
    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('commitHash'));
  });

  // 3. Server unconfigured API Key fails securely
  test('POST /api/scans/ingest fails securely with HTTP 500 when server API_KEY is empty', async () => {
    config.apiKey = '';

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'some_key')
      .send({ commitHash: 'abc1234567', branch: 'main' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.status, 'error');
    assert.ok(res.body.message.includes('Server authentication configuration is unavailable'));
  });

  // 4. Missing required metadata
  test('POST /api/scans/ingest returns HTTP 400 when required metadata (commitHash, branch) is missing', async () => {
    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({ branch: 'main' }); // missing commitHash

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('commitHash'));
  });

  // 5. Invalid or malformed scanner JSON
  test('POST /api/scans/ingest returns HTTP 400 when scanner payload contains malformed JSON string', async () => {
    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: 'a1b2c3d4e5f67890',
        branch: 'feature/ci',
        triggerEvent: 'push',
        scannerPayloads: {
          semgrep: 'invalid-not-json-string',
          trivy_fs: { Results: [] },
          trivy_image: { Results: [] },
        },
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('not valid JSON string'));
  });

  // 6. Missing required scanner coverage enforcement tests
  test('POST /api/scans/ingest returns HTTP 400 when only Semgrep is supplied', async () => {
    let dbCalled = false;
    let orchestratorCalled = false;
    db.query = async () => { dbCalled = true; return { rows: [] }; };
    orchestratorService.orchestrateScan = async () => { orchestratorCalled = true; return {}; };

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: 'a1b2c3d4e5f67890',
        branch: 'main',
        scannerPayloads: {
          semgrep: { results: [] },
        },
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('Missing required scanner reports'));
    assert.ok(res.body.message.includes('trivy_fs'));
    assert.ok(res.body.message.includes('trivy_image'));
    assert.strictEqual(dbCalled, false, 'No database query should be executed');
    assert.strictEqual(orchestratorCalled, false, 'No orchestrator should be invoked');
  });

  test('POST /api/scans/ingest returns HTTP 400 when Semgrep + Trivy filesystem supplied but image report missing', async () => {
    let dbCalled = false;
    let orchestratorCalled = false;
    db.query = async () => { dbCalled = true; return { rows: [] }; };
    orchestratorService.orchestrateScan = async () => { orchestratorCalled = true; return {}; };

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: 'a1b2c3d4e5f67890',
        branch: 'main',
        scannerPayloads: {
          semgrep: { results: [] },
          trivy_fs: { Results: [] },
        },
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('Missing required scanner reports'));
    assert.ok(res.body.message.includes('trivy_image'));
    assert.strictEqual(res.body.message.includes('semgrep'), false, 'Semgrep was supplied so should not be in missing list');
    assert.strictEqual(dbCalled, false, 'No database query should be executed');
    assert.strictEqual(orchestratorCalled, false, 'No orchestrator should be invoked');
  });

  // 7. Valid Ingestion Request with all three required reports supplied
  test('POST /api/scans/ingest returns HTTP 201 when all three reports are supplied', async () => {
    const semgrepFixture = fs.readFileSync(path.resolve(__dirname, '../fixtures/semgrep-sample.json'), 'utf8');
    const trivyFsFixture = fs.readFileSync(path.resolve(__dirname, '../fixtures/trivy-sample.json'), 'utf8');

    // Stub DB scan record insertion
    db.query = async (text, params) => {
      if (text.includes('INSERT INTO scans')) {
        return { rows: [{ id: '11111111-2222-3333-4444-555555555555', created_at: new Date() }] };
      }
      return { rows: [] };
    };

    // Stub orchestrator response
    orchestratorService.orchestrateScan = async ({ scanners }) => {
      assert.deepStrictEqual(scanners.sort(), ['semgrep', 'trivy_fs', 'trivy_image'].sort());
      return {
        status: 'COMPLETED',
        normalizedFindingCount: 5,
        riskAssessment: { overallRiskScore: 75.0, criticalCount: 1 },
        pipelineDecision: { decision: 'BLOCK', isBlocking: true },
        scannerExecutions: [
          { scannerName: 'semgrep', status: 'SUCCESS' },
          { scannerName: 'trivy_fs', status: 'SUCCESS' },
          { scannerName: 'trivy_image', status: 'SUCCESS' },
        ],
      };
    };

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: 'abcdef1234567890',
        branch: 'main',
        triggerEvent: 'push',
        initiatedBy: 'github-actions',
        scannerPayloads: {
          semgrep: semgrepFixture,
          trivy_fs: trivyFsFixture,
          trivy_image: { SchemaVersion: 2, ArtifactName: 'backend:latest', Results: [] },
        },
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.scanId, '11111111-2222-3333-4444-555555555555');
    assert.strictEqual(res.body.data.scanStatus, 'COMPLETED');
    assert.strictEqual(res.body.data.pipelineDecision.decision, 'BLOCK');
    assert.strictEqual(res.body.data.scannerExecutions.length, 3);
  });

  // 8. Orchestrator scanner failure returns HTTP 422 with BLOCK decision
  test('POST /api/scans/ingest returns HTTP 422 when orchestrator marks scan as FAILED', async () => {
    db.query = async () => ({ rows: [{ id: '99999999-8888-7777-6666-555555555555' }] });

    orchestratorService.orchestrateScan = async () => ({
      status: 'FAILED',
      normalizedFindingCount: 0,
      riskAssessment: null,
      pipelineDecision: {
        decision: 'BLOCK',
        isBlocking: true,
        decisionRationale: 'Required scanner failed',
      },
      errors: [{ scanner: 'semgrep', error: 'Process timeout' }],
    });

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: 'deadbeef12345678',
        branch: 'main',
        scannerPayloads: {
          semgrep: { results: [] },
          trivy_fs: { Results: [] },
          trivy_image: { Results: [] },
        },
      });

    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.status, 'fail');
    assert.strictEqual(res.body.data.scanStatus, 'FAILED');
    assert.strictEqual(res.body.data.pipelineDecision.decision, 'BLOCK');
    assert.strictEqual(res.body.data.pipelineDecision.isBlocking, true);
  });

  // 9. Database/persistence failure passes to centralized error handler safely
  test('POST /api/scans/ingest handles database insertion error without leaking credentials', async () => {
    db.query = async () => {
      throw new Error('Connection terminated unexpectedly: postgresql://admin:secret123@aws-1-ap-south-1.pooler.supabase.com:5432/db');
    };

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .send({
        commitHash: '12345678abcdef',
        branch: 'main',
        scannerPayloads: {
          semgrep: { results: [] },
          trivy_fs: { Results: [] },
          trivy_image: { Results: [] },
        },
      });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.status, 'error');
    // Ensure credentials and connection strings are masked
    assert.strictEqual(res.body.message, 'Internal server error');
  });

  // 10. GET /api/scans/:id retrieves scan details
  test('GET /api/scans/:id retrieves scan by valid UUID', async () => {
    db.query = async (text, params) => {
      if (params[0] === '11111111-2222-3333-4444-555555555555') {
        return {
          rows: [
            {
              id: '11111111-2222-3333-4444-555555555555',
              commit_hash: 'abcdef1234567890',
              status: 'COMPLETED',
              decision: 'PASS',
              is_blocking: false,
            },
          ],
        };
      }
      return { rows: [] };
    };

    const res = await request(app)
      .get('/api/scans/11111111-2222-3333-4444-555555555555')
      .set('x-api-key', 'test_devsecops_key_12345');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.id, '11111111-2222-3333-4444-555555555555');
  });

  // 11. GET /api/scans/:id returns 404 for unknown scan
  test('GET /api/scans/:id returns HTTP 404 when scan ID does not exist', async () => {
    db.query = async () => ({ rows: [] });

    const res = await request(app)
      .get('/api/scans/00000000-0000-0000-0000-000000000000')
      .set('x-api-key', 'test_devsecops_key_12345');

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('not found'));
  });

  // 12. Oversized payload returns HTTP 413
  test('POST /api/scans/ingest returns HTTP 413 when payload exceeds limit', async () => {
    // Generate a payload exceeding the 10MB limit (~11MB)
    const largeString = 'a'.repeat(11 * 1024 * 1024);

    const res = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'test_devsecops_key_12345')
      .set('Content-Type', 'application/json')
      .send(`{"commitHash":"1234567","branch":"main","scannerPayloads":{"semgrep":"${largeString}"}}`);

    assert.strictEqual(res.status, 413);
  });
});
