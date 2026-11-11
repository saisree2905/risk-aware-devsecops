const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../src/app');
const { config } = require('../../src/config/env');
const db = require('../../src/database');

describe('Unit Tests: Phase 5 Dashboard APIs & Safe Auth Split', () => {
  const originalApiKey = config.apiKey;
  const originalQuery = db.query;

  beforeEach(() => {
    config.apiKey = 'test_devsecops_key_12345';
  });

  afterEach(() => {
    config.apiKey = originalApiKey;
    db.query = originalQuery;
  });

  // ---------------------------------------------------------------------------
  // 1. Ingestion Endpoint Protection (Strictly Protected by apiKeyAuth)
  // ---------------------------------------------------------------------------
  test('POST /api/scans/ingest still strictly requires x-api-key', async () => {
    const resNoKey = await request(app)
      .post('/api/scans/ingest')
      .send({ commitHash: 'abc', branch: 'main' });
    assert.strictEqual(resNoKey.status, 401);
    assert.strictEqual(resNoKey.body.status, 'error');

    const resBadKey = await request(app)
      .post('/api/scans/ingest')
      .set('x-api-key', 'wrong_token')
      .send({ commitHash: 'abc', branch: 'main' });
    assert.strictEqual(resBadKey.status, 401);
    assert.strictEqual(resBadKey.body.status, 'error');
  });

  // ---------------------------------------------------------------------------
  // 2. Public Read Endpoints Work Without API Key
  // ---------------------------------------------------------------------------
  test('GET /api/dashboard/stats is publicly accessible without x-api-key', async () => {
    db.query = async (text) => {
      if (text.includes('FROM scans;')) {
        return { rows: [{ total_scans: '10', completed_scans: '8', failed_scans: '1', running_scans: '1' }] };
      }
      if (text.includes('FROM pipeline_decisions;')) {
        return { rows: [{ pass_count: '5', warn_count: '2', block_count: '1' }] };
      }
      if (text.includes('WHERE s.status = \'COMPLETED\'')) {
        return {
          rows: [{
            id: '11111111-2222-3333-4444-555555555555',
            commit_hash: '3b94edd616ff',
            branch: 'main',
            status: 'COMPLETED',
            overall_risk_score: '44.50',
            decision: 'WARN',
            is_blocking: false,
            total_findings: '9',
          }],
        };
      }
      if (text.includes('FROM policies')) {
        return {
          rows: [{
            id: '22222222-3333-4444-5555-666666666666',
            name: 'Standard Enterprise Policy',
            version: '1.0.0',
            max_critical_count: 0,
            max_high_count: 2,
            max_risk_score: '70.00',
            warn_risk_score: '40.00',
          }],
        };
      }
      if (text.includes('FROM security_findings;')) {
        return {
          rows: [{
            total_findings: '9',
            critical_count: '0',
            high_count: '0',
            medium_count: '4',
            low_count: '0',
            info_count: '5',
          }],
        };
      }
      return { rows: [] };
    };

    const res = await request(app).get('/api/dashboard/stats');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.scans.total, 10);
    assert.strictEqual(res.body.data.scans.completed, 8);
    assert.strictEqual(res.body.data.decisions.warn, 2);
    assert.strictEqual(res.body.data.latestScan.commit_hash, '3b94edd616ff');
    assert.strictEqual(res.body.data.activePolicy.name, 'Standard Enterprise Policy');
  });

  test('GET /api/scans is publicly accessible and supports pagination and filtering', async () => {
    db.query = async (text, params) => {
      if (text.includes('COUNT(*) AS total')) {
        return { rows: [{ total: '2' }] };
      }
      return {
        rows: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            commit_hash: '3b94edd616ff',
            branch: 'main',
            status: 'COMPLETED',
            decision: 'WARN',
            is_blocking: false,
            overall_risk_score: '44.50',
            total_findings: '9',
          },
        ],
      };
    };

    const res = await request(app)
      .get('/api/scans?page=1&limit=10&decision=WARN&status=COMPLETED&branch=main');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.scans.length, 1);
    assert.strictEqual(res.body.data.pagination.page, 1);
    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(res.body.data.pagination.total, 2);
  });

  test('GET /api/scans rejects invalid filter query parameters', async () => {
    const res = await request(app).get('/api/scans?decision=INVALID_DECISION');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('Invalid decision filter'));
  });

  test('GET /api/scans caps maximum pagination limit ceiling to 100', async () => {
    let capturedLimit = null;
    db.query = async (text, params) => {
      if (text.includes('COUNT(*) AS total')) return { rows: [{ total: '0' }] };
      capturedLimit = params[params.length - 2];
      return { rows: [] };
    };

    const res = await request(app).get('/api/scans?limit=500');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.pagination.limit, 100);
    assert.strictEqual(capturedLimit, 100);
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/scans/:id/full (Complete Audit View)
  // ---------------------------------------------------------------------------
  test('GET /api/scans/:id/full returns comprehensive audit details without x-api-key', async () => {
    const testScanId = '5e10a74b-b5b1-42d5-a8fd-2d56dc62c242';

    db.query = async (text, params) => {
      if (text.includes('FROM scans s') && text.includes('LEFT JOIN policies p')) {
        return {
          rows: [{
            id: testScanId,
            commit_hash: '3b94edd616ff7258ba3d2a34b8fc79fd8a23cb5d',
            branch: 'main',
            status: 'COMPLETED',
            overall_risk_score: '44.50',
            decision: 'WARN',
            is_blocking: false,
            policy_name: 'Standard Enterprise Policy',
          }],
        };
      }
      if (text.includes('FROM scanner_metadata')) {
        return {
          rows: [
            { scanner_name: 'semgrep', scanner_version: 'fixture-mock', execution_time_ms: 15, exit_code: 0 },
            { scanner_name: 'trivy_fs', scanner_version: 'fixture-mock', execution_time_ms: 15, exit_code: 0 },
            { scanner_name: 'trivy_image', scanner_version: 'fixture-mock', execution_time_ms: 15, exit_code: 0 },
          ],
        };
      }
      if (text.includes('FROM security_findings') && text.includes('GROUP BY scanner_name, severity')) {
        return {
          rows: [
            { scanner_name: 'semgrep', severity: 'MEDIUM', count: '4' },
            { scanner_name: 'semgrep', severity: 'INFO', count: '5' },
          ],
        };
      }
      if (text.includes('COUNT(*) AS total FROM security_findings')) {
        return { rows: [{ total: '9' }] };
      }
      return { rows: [] };
    };

    const res = await request(app).get(`/api/scans/${testScanId}/full`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.scan.id, testScanId);
    assert.strictEqual(res.body.data.scannerExecutions.length, 3);
    assert.strictEqual(res.body.data.findingsSummary.length, 2);
    assert.strictEqual(res.body.data.totalFindings, 9);
  });

  test('GET /api/scans/:id/full rejects invalid UUIDs', async () => {
    const res = await request(app).get('/api/scans/invalid-uuid-format/full');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, 'fail');
    assert.ok(res.body.message.includes('Invalid scan ID format'));
  });

  test('GET /api/scans/:id/full returns HTTP 404 when scan ID does not exist', async () => {
    db.query = async () => ({ rows: [] });
    const res = await request(app).get('/api/scans/00000000-0000-0000-0000-000000000000/full');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.status, 'fail');
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/scans/:id/findings (Findings View with Allowlisted Fields)
  // ---------------------------------------------------------------------------
  test('GET /api/scans/:id/findings returns strictly allowlisted fields and excludes raw_payload', async () => {
    const testScanId = '5e10a74b-b5b1-42d5-a8fd-2d56dc62c242';

    db.query = async (text, params) => {
      if (text.includes('SELECT id FROM scans')) {
        return { rows: [{ id: testScanId }] };
      }
      if (text.includes('SELECT COUNT(*) AS total FROM security_findings')) {
        return { rows: [{ total: '1' }] };
      }
      if (text.includes('FROM security_findings')) {
        // Assert raw_payload is not in query string
        assert.strictEqual(text.includes('raw_payload'), false, 'raw_payload must never be queried');
        return {
          rows: [{
            id: '30916f4a-f388-47ea-8a9c-09188eada571',
            scan_id: testScanId,
            scanner_name: 'semgrep',
            finding_id: 'rule-xss',
            vuln_id: 'CWE-79',
            title: 'Reflected XSS',
            description: 'Direct response writing detected',
            severity: 'MEDIUM',
            cvss_score: null,
            affected_component: 'security-tests/vulnerable-app/index.js:11',
            affected_version: null,
            fixed_version: null,
            remediation: 'Use res.send with safe templating',
            created_at: '2026-11-11T17:31:57.366Z',
          }],
        };
      }
      return { rows: [] };
    };

    const res = await request(app)
      .get(`/api/scans/${testScanId}/findings?page=1&limit=25&severity=MEDIUM&scanner=semgrep`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.findings.length, 1);
    const finding = res.body.data.findings[0];
    assert.strictEqual(finding.title, 'Reflected XSS');
    assert.strictEqual(finding.raw_payload, undefined, 'raw_payload must not be exposed');
    assert.strictEqual(res.body.data.pagination.total, 1);
  });

  test('GET /api/scans/:id/findings rejects invalid severity or scanner filters', async () => {
    const testScanId = '5e10a74b-b5b1-42d5-a8fd-2d56dc62c242';
    const resSev = await request(app).get(`/api/scans/${testScanId}/findings?severity=SUPER_CRITICAL`);
    assert.strictEqual(resSev.status, 400);
    assert.ok(resSev.body.message.includes('Invalid severity filter'));

    const resSc = await request(app).get(`/api/scans/${testScanId}/findings?scanner=unsupported_scanner`);
    assert.strictEqual(resSc.status, 400);
    assert.ok(resSc.body.message.includes('Invalid scanner filter'));
  });

  // ---------------------------------------------------------------------------
  // 5. GET /api/policies (Policy Rules & Ceilings)
  // ---------------------------------------------------------------------------
  test('GET /api/policies returns list of security policies without x-api-key', async () => {
    db.query = async () => ({
      rows: [{
        id: '323d33f6-ed75-4704-8862-5d981f59a34e',
        name: 'Standard Enterprise Policy',
        version: '1.0.0',
        description: 'Blocks on CRITICAL or risk >= 70',
        is_active: true,
        max_critical_count: 0,
        max_high_count: 2,
        max_risk_score: '70.00',
        warn_risk_score: '40.00',
        fail_on_block: true,
      }],
    });

    const res = await request(app).get('/api/policies');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.policies.length, 1);
    assert.strictEqual(res.body.data.policies[0].name, 'Standard Enterprise Policy');
    assert.strictEqual(res.body.data.policies[0].max_risk_score, '70.00');
  });

  // ---------------------------------------------------------------------------
  // 6. Database Error Masking & Credential Protection
  // ---------------------------------------------------------------------------
  test('Dashboard endpoints handle database error without leaking credentials', async () => {
    db.query = async () => {
      const err = new Error('Connection terminated: postgresql://admin:secret123@supabase-host.com:5432/postgres');
      err.code = 'ECONNRESET';
      throw err;
    };

    const res = await request(app).get('/api/dashboard/stats');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.status, 'error');
    assert.strictEqual(res.body.message, 'Internal server error');
    assert.strictEqual(JSON.stringify(res.body).includes('secret123'), false);
    assert.strictEqual(JSON.stringify(res.body).includes('postgresql://'), false);
  });
});
