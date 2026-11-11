const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../../src/database');
const { orchestrateScan } = require('../../src/services/orchestrator.service');

describe('Integration Tests: Scanner Orchestration & Persistence in Supabase', () => {
  let testScanId = null;

  before(async () => {
    // Create an ephemeral test scan record in Supabase
    const { rows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('phase3-scanner-hash', 'scanner-integration', 'push', 'PENDING')
       RETURNING id;`
    );
    testScanId = rows[0].id;
  });

  after(async () => {
    if (testScanId) {
      // Respect ON DELETE RESTRICT dependencies during clean-up
      await query('DELETE FROM pipeline_decisions WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM risk_assessments WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM security_findings WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM scanner_metadata WHERE scan_id = $1;', [testScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [testScanId]);
    }
    await closePool();
  });

  test('orchestrateScan processes normalized findings, records scanner_metadata, and evaluates policy', async () => {
    const semgrepRaw = fs.readFileSync(path.resolve(__dirname, '../fixtures/semgrep-sample.json'), 'utf8');
    const trivyRaw = fs.readFileSync(path.resolve(__dirname, '../fixtures/trivy-sample.json'), 'utf8');

    // Orchestrate with pre-recorded authentic fixtures
    const result = await orchestrateScan({
      scanId: testScanId,
      targetPath: '.',
      scanners: ['semgrep', 'trivy_fs'],
      mockOutputs: {
        semgrep: semgrepRaw,
        trivy_fs: trivyRaw,
      },
    });

    assert.strictEqual(result.scanId, testScanId);
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.scannerExecutions.length, 2);
    assert.strictEqual(result.normalizedFindingCount, 6); // 3 semgrep + 3 trivy
    assert.strictEqual(result.pipelineDecision.decision, 'BLOCK');
    assert.strictEqual(result.pipelineDecision.isBlocking, true);

    // Verify Supabase database persistence for scanner_metadata
    const { rows: metaRows } = await query(
      'SELECT scanner_name, execution_time_ms, exit_code FROM scanner_metadata WHERE scan_id = $1 ORDER BY scanner_name ASC;',
      [testScanId]
    );
    assert.strictEqual(metaRows.length, 2);
    assert.strictEqual(metaRows[0].scanner_name, 'semgrep');
    assert.strictEqual(metaRows[1].scanner_name, 'trivy_fs');

    // Verify security_findings persistence in Supabase
    const { rows: findingRows } = await query(
      'SELECT scanner_name, severity FROM security_findings WHERE scan_id = $1;',
      [testScanId]
    );
    assert.strictEqual(findingRows.length, 6);

    // Verify scan status updated to COMPLETED in Supabase
    const { rows: scanRows } = await query(
      'SELECT status, completed_at FROM scans WHERE id = $1;',
      [testScanId]
    );
    assert.strictEqual(scanRows[0].status, 'COMPLETED');
    assert.ok(scanRows[0].completed_at);
  });

  test('Scanner failure does not masquerade as clean scan; marks scan FAILED and persists synthetic BLOCK decision', async () => {
    // Ephemeral scan for failure path
    const { rows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('phase3-failure-hash', 'scanner-integration', 'push', 'PENDING')
       RETURNING id;`
    );
    const failScanId = rows[0].id;

    try {
      // Intentionally request non-existent scanner or mock failure
      const result = await orchestrateScan({
        scanId: failScanId,
        targetPath: '.',
        scanners: ['semgrep'], // Local environment does not have semgrep binary installed
      });

      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.pipelineDecision.decision, 'BLOCK');
      assert.strictEqual(result.pipelineDecision.isBlocking, true);
      assert.ok(result.pipelineDecision.decisionRationale.includes('Pipeline halted: Required security scanner(s) failed'));

      // Verify status in DB is FAILED
      const { rows: dbScan } = await query('SELECT status FROM scans WHERE id = $1;', [failScanId]);
      assert.strictEqual(dbScan[0].status, 'FAILED');

      // Verify synthetic BLOCK decision is persisted in pipeline_decisions
      const { rows: dbDecisions } = await query(
        'SELECT decision, is_blocking, decision_rationale FROM pipeline_decisions WHERE scan_id = $1;',
        [failScanId]
      );
      assert.strictEqual(dbDecisions.length, 1);
      assert.strictEqual(dbDecisions[0].decision, 'BLOCK');
      assert.strictEqual(dbDecisions[0].is_blocking, true);
      assert.ok(dbDecisions[0].decision_rationale.includes('Required security scanner(s) failed'));
    } finally {
      await query('DELETE FROM pipeline_decisions WHERE scan_id = $1;', [failScanId]);
      await query('DELETE FROM scanner_metadata WHERE scan_id = $1;', [failScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [failScanId]);
    }
  });

  test('Scanner failure persistence idempotency: re-running failure on the same scan updates existing decision without duplicates', async () => {
    const { rows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('phase3-failure-retry-hash', 'scanner-integration', 'push', 'PENDING')
       RETURNING id;`
    );
    const retryScanId = rows[0].id;

    try {
      // First run: scanner fails
      const result1 = await orchestrateScan({
        scanId: retryScanId,
        targetPath: '.',
        scanners: ['semgrep'],
      });
      assert.strictEqual(result1.status, 'FAILED');

      // Second run: retry same scan
      const result2 = await orchestrateScan({
        scanId: retryScanId,
        targetPath: '.',
        scanners: ['semgrep'],
      });
      assert.strictEqual(result2.status, 'FAILED');

      // Verify exactly ONE pipeline_decisions row exists
      const { rows: decisions } = await query(
        'SELECT decision, is_blocking FROM pipeline_decisions WHERE scan_id = $1;',
        [retryScanId]
      );
      assert.strictEqual(decisions.length, 1);
      assert.strictEqual(decisions[0].decision, 'BLOCK');
      assert.strictEqual(decisions[0].is_blocking, true);
    } finally {
      await query('DELETE FROM pipeline_decisions WHERE scan_id = $1;', [retryScanId]);
      await query('DELETE FROM scanner_metadata WHERE scan_id = $1;', [retryScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [retryScanId]);
    }
  });

  test('Scanner failure handles policy ambiguity: zero active policies safely without crashing or arbitrary selection', async () => {
    const { rows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('phase3-policy-zero-hash', 'scanner-integration', 'push', 'PENDING')
       RETURNING id;`
    );
    const zeroScanId = rows[0].id;

    // Temporarily deactivate policies to simulate zero active policies
    await query('UPDATE policies SET is_active = FALSE;');

    try {
      const result = await orchestrateScan({
        scanId: zeroScanId,
        targetPath: '.',
        scanners: ['semgrep'],
      });

      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.pipelineDecision.decision, 'BLOCK');
      assert.strictEqual(result.pipelineDecision.isBlocking, true);
      assert.strictEqual(result.pipelineDecision.persistenceStatus, 'UNAVAILABLE_POLICY_CONFIG');
      assert.ok(result.pipelineDecision.decisionRationale.includes('policy configuration issue'));

      // Verify scan in DB is marked FAILED
      const { rows: dbScan } = await query('SELECT status FROM scans WHERE id = $1;', [zeroScanId]);
      assert.strictEqual(dbScan[0].status, 'FAILED');

      // Verify no arbitrary pipeline decision was inserted
      const { rows: decisions } = await query(
        'SELECT * FROM pipeline_decisions WHERE scan_id = $1;',
        [zeroScanId]
      );
      assert.strictEqual(decisions.length, 0);

      // Verify scanner metadata failure record is preserved
      const { rows: meta } = await query(
        'SELECT scanner_name, exit_code FROM scanner_metadata WHERE scan_id = $1;',
        [zeroScanId]
      );
      assert.strictEqual(meta.length, 1);
      assert.strictEqual(meta[0].scanner_name, 'semgrep');
    } finally {
      // Restore default active policy
      await query("UPDATE policies SET is_active = TRUE WHERE name = 'Standard Enterprise Policy';");
      await query('DELETE FROM scanner_metadata WHERE scan_id = $1;', [zeroScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [zeroScanId]);
    }
  });

  test('Scanner failure handles policy ambiguity: multiple active policies safely without crashing or arbitrary selection', async () => {
    const { rows: scanRows } = await query(
      `INSERT INTO scans (commit_hash, branch, trigger_event, status)
       VALUES ('phase3-policy-multi-hash', 'scanner-integration', 'push', 'PENDING')
       RETURNING id;`
    );
    const multiScanId = scanRows[0].id;

    // Insert an ephemeral second active policy to create multiple active policies
    const { rows: policyRows } = await query(
      `INSERT INTO policies (
        name, version, description, is_active, max_critical_count, max_high_count,
        max_risk_score, warn_risk_score, fail_on_block
      ) VALUES (
        'Ephemeral Second Policy', '1.0.0', 'Temporary active policy for ambiguity test',
        TRUE, 0, 1, 60.00, 30.00, TRUE
      ) RETURNING id;`
    );
    const ephemeralPolicyId = policyRows[0].id;

    try {
      const result = await orchestrateScan({
        scanId: multiScanId,
        targetPath: '.',
        scanners: ['semgrep'],
      });

      // 1. Scan remains FAILED
      assert.strictEqual(result.status, 'FAILED');

      // 2. Returned decision is BLOCK with isBlocking = true
      assert.strictEqual(result.pipelineDecision.decision, 'BLOCK');
      assert.strictEqual(result.pipelineDecision.isBlocking, true);
      assert.strictEqual(result.pipelineDecision.persistenceStatus, 'UNAVAILABLE_POLICY_CONFIG');
      assert.ok(result.pipelineDecision.decisionRationale.includes('Ambiguous policy state'));

      // 3. Scan in DB is marked FAILED
      const { rows: dbScan } = await query('SELECT status FROM scans WHERE id = $1;', [multiScanId]);
      assert.strictEqual(dbScan[0].status, 'FAILED');

      // 4. No arbitrary policy selected; no invalid pipeline_decisions record inserted
      const { rows: decisions } = await query(
        'SELECT * FROM pipeline_decisions WHERE scan_id = $1;',
        [multiScanId]
      );
      assert.strictEqual(decisions.length, 0);

      // 5. Scanner failure metadata is preserved
      const { rows: meta } = await query(
        'SELECT scanner_name, exit_code FROM scanner_metadata WHERE scan_id = $1;',
        [multiScanId]
      );
      assert.strictEqual(meta.length, 1);
      assert.strictEqual(meta[0].scanner_name, 'semgrep');
    } finally {
      // Clean up ephemeral policy and scan records
      await query('DELETE FROM policies WHERE id = $1;', [ephemeralPolicyId]);
      await query('DELETE FROM scanner_metadata WHERE scan_id = $1;', [multiScanId]);
      await query('DELETE FROM scans WHERE id = $1;', [multiScanId]);
    }
  });
});
