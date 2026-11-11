const { test, describe } = require('node:test');
const assert = require('node:assert');
const { evaluatePolicy, PolicyConfigurationError } = require('../../src/policy-engine');

describe('Unit Tests: Policy Evaluation Engine', () => {
  const standardPolicy = {
    id: 'b5f25a51-9e73-4e4b-97e3-000000000001',
    name: 'Standard Enterprise Policy',
    version: '1.0.0',
    max_critical_count: 0,
    max_high_count: 2,
    max_risk_score: 70.00,
    warn_risk_score: 40.00,
    fail_on_block: true,
  };

  test('Decision: PASS for clean scan or low findings below warning thresholds', () => {
    const assessment = {
      overallRiskScore: 15.00,
      counts: { critical_count: 0, high_count: 0, medium_count: 0, low_count: 1, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'PASS');
    assert.strictEqual(outcome.isBlocking, false);
    assert.ok(outcome.decisionRationale.includes('Policy PASS'));
  });

  test('Decision: WARN when score crosses warn_risk_score (40.00) without crossing BLOCK limits', () => {
    const assessment = {
      overallRiskScore: 43.00,
      counts: { critical_count: 0, high_count: 0, medium_count: 2, low_count: 3, info_count: 5 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'WARN');
    assert.strictEqual(outcome.isBlocking, false);
    assert.ok(outcome.decisionRationale.includes('Policy WARN issued'));
  });

  test('Decision: WARN when medium_count > 5 without crossing BLOCK limits', () => {
    const assessment = {
      overallRiskScore: 35.00,
      counts: { critical_count: 0, high_count: 0, medium_count: 6, low_count: 0, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'WARN');
    assert.strictEqual(outcome.isBlocking, false);
  });

  test('Decision: BLOCK when critical_count > max_critical_count (1 > 0)', () => {
    const assessment = {
      overallRiskScore: 90.00,
      counts: { critical_count: 1, high_count: 0, medium_count: 0, low_count: 0, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'BLOCK');
    assert.strictEqual(outcome.isBlocking, true);
    assert.ok(outcome.decisionRationale.includes('Critical vulnerability count (1) exceeds policy ceiling of 0'));
  });

  test('Decision: BLOCK when high_count > max_high_count (3 > 2)', () => {
    const assessment = {
      overallRiskScore: 68.00,
      counts: { critical_count: 0, high_count: 3, medium_count: 0, low_count: 0, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'BLOCK');
    assert.strictEqual(outcome.isBlocking, true);
    assert.ok(outcome.decisionRationale.includes('High vulnerability count (3) exceeds policy ceiling of 2'));
  });

  test('Decision: BLOCK when overall_risk_score >= max_risk_score even if high_count <= max_high_count', () => {
    // 1 High finding with score 71.50 (high_count=1 <= max_high_count=2, but score 71.50 >= 70.00)
    const assessment = {
      overallRiskScore: 71.50,
      counts: { critical_count: 0, high_count: 1, medium_count: 1, low_count: 0, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, standardPolicy);
    assert.strictEqual(outcome.decision, 'BLOCK');
    assert.strictEqual(outcome.isBlocking, true);
    assert.ok(outcome.decisionRationale.includes('Overall risk score (71.50) meets or exceeds policy blocking threshold (70.00)'));
  });

  test('Separation of decision and enforcement: BLOCK with fail_on_block: false keeps decision=BLOCK, isBlocking=false', () => {
    const advisoryPolicy = {
      ...standardPolicy,
      fail_on_block: false,
    };
    const assessment = {
      overallRiskScore: 95.00,
      counts: { critical_count: 1, high_count: 0, medium_count: 0, low_count: 0, info_count: 0 },
    };
    const outcome = evaluatePolicy(assessment, advisoryPolicy);
    assert.strictEqual(outcome.decision, 'BLOCK');
    assert.strictEqual(outcome.isBlocking, false); // pipeline job does not fail
    assert.ok(outcome.decisionRationale.includes('fail_on_block disabled'));
  });

  test('Missing policy object throws explicit PolicyConfigurationError', () => {
    assert.throws(() => {
      evaluatePolicy({ overallRiskScore: 0 }, null);
    }, PolicyConfigurationError);
  });
});
