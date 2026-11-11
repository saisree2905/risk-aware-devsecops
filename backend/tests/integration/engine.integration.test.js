const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { query, closePool } = require('../../src/database');
const { getActivePolicy } = require('../../src/services/policy.service');
const { processScanAssessment } = require('../../src/services/assessment.service');
const { PolicyConfigurationError } = require('../../src/policy-engine');

describe('Integration Tests: Policy & Assessment Persistence in Supabase', () => {
  let testScanId = null;

  before(async () => {
    // Create an ephemeral test scan record in Supabase
    const { rows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('test-hash-phase2', 'phase-2-test', 'test-suite', 'RUNNING')
       RETURNING id;`
    );
    testScanId = rows[0].id;
  });

  after(async () => {
    if (testScanId) {
      // Clean up test records using explicit dependency order (due to ON DELETE RESTRICT)
      await query('DELETE FROM pipeline_decisions WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM risk_assessments WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM security_findings WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [testScanId]);
    }
    await closePool();
  });

  test('getActivePolicy retrieves seeded Standard Enterprise Policy successfully', async () => {
    const policy = await getActivePolicy();
    assert.ok(policy.id);
    assert.strictEqual(policy.name, 'Standard Enterprise Policy');
    assert.strictEqual(policy.version, '1.0.0');
    assert.strictEqual(policy.is_active, true);
    assert.strictEqual(Number(policy.max_critical_count), 0);
    assert.strictEqual(Number(policy.max_high_count), 2);
    assert.strictEqual(Number(policy.max_risk_score), 70.00);
  });

  test('processScanAssessment atomically persists findings, risk assessment, and decision in Supabase', async () => {
    const findings = [
      {
        scanner_name: 'semgrep',
        vuln_id: 'CWE-89',
        title: 'SQL Injection in user lookup',
        severity: 'CRITICAL',
        cvss_score: 9.8,
        affected_component: 'backend/src/routes/user.js',
      },
      {
        scanner_name: 'trivy',
        vuln_id: 'CVE-2023-44487',
        title: 'HTTP/2 Rapid Reset Attack',
        severity: 'HIGH',
        cvss_score: 7.5,
        affected_component: 'express@4.18.2',
      },
    ];

    const result = await processScanAssessment({
      scanId: testScanId,
      findings,
    });

    // Check in-memory result
    assert.strictEqual(result.scanId, testScanId);
    assert.strictEqual(result.pipelineDecision.decision, 'BLOCK');
    assert.strictEqual(result.pipelineDecision.isBlocking, true);
    assert.strictEqual(result.riskAssessment.counts.critical_count, 1);
    assert.strictEqual(result.riskAssessment.counts.high_count, 1);

    // Verify Supabase database persistence directly via SQL queries
    const { rows: dbFindings } = await query(
      'SELECT id, vuln_id, severity FROM security_findings WHERE scan_id = $1;',
      [testScanId]
    );
    assert.strictEqual(dbFindings.length, 2);

    const { rows: dbAssessment } = await query(
      'SELECT overall_risk_score, critical_count, high_count FROM risk_assessments WHERE scan_id = $1;',
      [testScanId]
    );
    assert.strictEqual(dbAssessment.length, 1);
    assert.strictEqual(Number(dbAssessment[0].critical_count), 1);
    assert.strictEqual(Number(dbAssessment[0].high_count), 1);

    const { rows: dbDecision } = await query(
      'SELECT decision, is_blocking FROM pipeline_decisions WHERE scan_id = $1;',
      [testScanId]
    );
    assert.strictEqual(dbDecision.length, 1);
    assert.strictEqual(dbDecision[0].decision, 'BLOCK');
    assert.strictEqual(dbDecision[0].is_blocking, true);

    const { rows: dbScan } = await query(
      'SELECT status, completed_at FROM scans WHERE id = $1;',
      [testScanId]
    );
    assert.strictEqual(dbScan[0].status, 'COMPLETED');
    assert.ok(dbScan[0].completed_at);
  });
});
