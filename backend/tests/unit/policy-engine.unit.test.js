const { test, describe } = require('node:test');
const assert = require('node:assert');
const { evaluatePolicy, PolicyConfigurationError } = require('../../src/policy-engine');
const policyService = require('../../src/services/policy.service');
const { query } = require('../../src/database');

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

  test('Dynamic Policy Thresholds: Custom lenient policy dynamically respects custom thresholds', () => {
    const lenientPolicy = {
      id: 'custom-lenient-policy-id',
      name: 'Custom Lenient Dev Policy',
      version: '2.0.0',
      max_critical_count: 2,
      max_high_count: 5,
      max_risk_score: 95.00,
      warn_risk_score: 60.00,
      fail_on_block: true,
    };

    // Under Standard Policy (max_high: 2, max_risk: 70), 3 Highs with score 79 is a BLOCK.
    // Under Lenient Policy (max_high: 5, max_risk: 95), this is a WARN, proving thresholds are dynamic.
    const assessment = {
      overallRiskScore: 79.00,
      counts: { critical_count: 0, high_count: 3, medium_count: 0, low_count: 0, info_count: 0 },
    };

    const outcome = evaluatePolicy(assessment, lenientPolicy);
    assert.strictEqual(outcome.decision, 'WARN');
    assert.strictEqual(outcome.isBlocking, false);
    assert.strictEqual(outcome.evaluatedRules.maxHigh, 5);
    assert.strictEqual(outcome.evaluatedRules.maxRiskScore, 95.00);
  });

  test('Policy Service: Zero active policies throws explicit PolicyConfigurationError', async () => {
    // Stub query returning empty rows
    const originalQuery = require('../../src/database').query;
    const dbModule = require('../../src/database');
    dbModule.query = async () => ({ rows: [] });

    try {
      await assert.rejects(
        async () => {
          await policyService.getActivePolicy();
        },
        (err) => {
          assert.strictEqual(err.name, 'PolicyConfigurationError');
          assert.ok(err.message.includes('No active security policy found'));
          return true;
        }
      );
    } finally {
      dbModule.query = originalQuery;
    }
  });

  test('Policy Service: Multiple active policies throws explicit PolicyConfigurationError', async () => {
    // Stub query returning 2 active policies
    const originalQuery = require('../../src/database').query;
    const dbModule = require('../../src/database');
    dbModule.query = async () => ({
      rows: [
        { id: 'pol-1', name: 'Policy 1', is_active: true },
        { id: 'pol-2', name: 'Policy 2', is_active: true },
      ],
    });

    try {
      await assert.rejects(
        async () => {
          await policyService.getActivePolicy();
        },
        (err) => {
          assert.strictEqual(err.name, 'PolicyConfigurationError');
          assert.ok(err.message.includes('Ambiguous policy state: Multiple active policies detected'));
          return true;
        }
      );
    } finally {
      dbModule.query = originalQuery;
    }
  });
});
