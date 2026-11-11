const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  calculateRisk,
  calculateFindingScore,
  deduplicateFindings,
} = require('../../src/risk-engine');

describe('Unit Tests: Risk Assessment Engine', () => {
  test('Scenario 1: Clean scan with zero findings produces 0.00 score', () => {
    const result = calculateRisk([]);
    assert.strictEqual(result.overallRiskScore, 0.00);
    assert.strictEqual(result.counts.critical_count, 0);
    assert.strictEqual(result.counts.high_count, 0);
    assert.strictEqual(result.dominantFinding, null);
    assert.strictEqual(result.compoundingBonus, 0.00);
  });

  test('Scenario 2: Single LOW finding without CVSS produces base score of 15.00', () => {
    const findings = [{ severity: 'LOW', title: 'Hardcoded TODO' }];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 15.00);
    assert.strictEqual(result.dominantFinding.score, 15.00);
    assert.strictEqual(result.compoundingBonus, 0.00);
  });

  test('Scenario 3: Single LOW with CVSS 3.0 modulates score to 19.50', () => {
    // 0.70 * 15 + 0.30 * 30 = 10.5 + 9.0 = 19.50
    const findings = [{ severity: 'LOW', cvss_score: 3.0, title: 'Minor info disclosure' }];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 19.50);
  });

  test('Scenario 4: Minor notices (2 MED, 3 LOW, 5 INFO) produces exact score of 43.00', () => {
    // Dominant: MED (score 40.00).
    // Remaining: 1 MED (1.5) + 3 LOW (3 * 0.5 = 1.5) + 5 INFO (0) = 3.00 bonus.
    // Total = 40.00 + 3.00 = 43.00.
    const findings = [
      { severity: 'MEDIUM', title: 'Med 1', vuln_id: 'M1' },
      { severity: 'MEDIUM', title: 'Med 2', vuln_id: 'M2' },
      { severity: 'LOW', title: 'Low 1', vuln_id: 'L1' },
      { severity: 'LOW', title: 'Low 2', vuln_id: 'L2' },
      { severity: 'LOW', title: 'Low 3', vuln_id: 'L3' },
      { severity: 'INFO', title: 'Info 1', vuln_id: 'I1' },
      { severity: 'INFO', title: 'Info 2', vuln_id: 'I2' },
      { severity: 'INFO', title: 'Info 3', vuln_id: 'I3' },
      { severity: 'INFO', title: 'Info 4', vuln_id: 'I4' },
      { severity: 'INFO', title: 'Info 5', vuln_id: 'I5' },
    ];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 43.00);
    assert.strictEqual(result.dominantFinding.score, 40.00);
    assert.strictEqual(result.compoundingBonus, 3.00);
    assert.strictEqual(result.counts.medium_count, 2);
    assert.strictEqual(result.counts.low_count, 3);
    assert.strictEqual(result.counts.info_count, 5);
  });

  test('Scenario 5: High finding with score-triggered block (1 HIGH, 1 MED without CVSS) produces 71.50', () => {
    // Dominant: HIGH (70.00). Remaining: 1 MED (1.5). Overall = 71.50.
    const findings = [
      { severity: 'HIGH', title: 'Insecure cookie', vuln_id: 'H1' },
      { severity: 'MEDIUM', title: 'Missing CSRF', vuln_id: 'M1' },
    ];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 71.50);
    assert.strictEqual(result.dominantFinding.score, 70.00);
    assert.strictEqual(result.compoundingBonus, 1.50);
  });

  test('Scenario 6: CRITICAL with anomalous low CVSS (2.0) triggers 85% severity floor protection (76.50)', () => {
    // 0.70 * 90 + 0.30 * 20 = 63 + 6 = 69.00 < floor (0.85 * 90 = 76.50) -> clamped to 76.50
    const findings = [{ severity: 'CRITICAL', cvss_score: 2.0, title: 'RCE with low CVSS' }];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 76.50);
    assert.ok(result.assessmentRationale.includes('Floor protection applied'));
  });

  test('Scenario 7: Missing, invalid, NaN or out-of-bounds CVSS falls back safely to severity base weight', () => {
    const f1 = calculateFindingScore({ severity: 'HIGH', cvss_score: null });
    assert.strictEqual(f1.score, 70.00);
    assert.strictEqual(f1.cvssUsed, false);

    const f2 = calculateFindingScore({ severity: 'HIGH', cvss_score: 'not-a-number' });
    assert.strictEqual(f2.score, 70.00);

    const f3 = calculateFindingScore({ severity: 'HIGH', cvss_score: 15.0 }); // out of bounds > 10
    assert.strictEqual(f3.score, 70.00);

    const f4 = calculateFindingScore({ severity: 'HIGH', cvss_score: -2.0 }); // negative
    assert.strictEqual(f4.score, 70.00);
  });

  test('Scenario 8: Deterministic tie-breaking selects highest score -> highest severity -> stable key', () => {
    const findings = [
      { scanner_name: 'semgrep', vuln_id: 'RULE_B', severity: 'HIGH', affected_component: 'app.js' },
      { scanner_name: 'semgrep', vuln_id: 'RULE_A', severity: 'HIGH', affected_component: 'app.js' },
    ];
    const result = calculateRisk(findings);
    // Both score 70.00, both HIGH, stable key 'semgrep::RULE_A::app.js' comes first alphabetically
    assert.ok(result.dominantFinding.key.toLowerCase().includes('rule_a'));
    assert.strictEqual(result.compoundingBonus, 3.00); // exactly one excluded from bonus
    assert.strictEqual(result.overallRiskScore, 73.00);
  });

  test('Scenario 9: Duplicate finding records are deduplicated safely without double-counting', () => {
    const findings = [
      { scanner_name: 'trivy', vuln_id: 'CVE-2023-1111', severity: 'HIGH', cvss_score: 7.0, affected_component: 'lodash' },
      { scanner_name: 'trivy', vuln_id: 'CVE-2023-1111', severity: 'HIGH', cvss_score: 7.0, affected_component: 'lodash' }, // exact duplicate
      { scanner_name: 'trivy', vuln_id: 'CVE-2023-1111', severity: 'HIGH', cvss_score: 8.5, affected_component: 'lodash' }, // duplicate with higher CVSS
    ];
    const deduplicated = deduplicateFindings(findings);
    assert.strictEqual(deduplicated.length, 1);
    // Highest CVSS preserved: 0.70 * 70 + 0.30 * 85 = 49 + 25.5 = 74.50
    assert.strictEqual(deduplicated[0]._evaluated.score, 74.50);
  });

  test('Scenario 10: Compound risk is strictly capped at 100.00', () => {
    const findings = [
      { severity: 'CRITICAL', cvss_score: 10.0, vuln_id: 'C1' },
      { severity: 'CRITICAL', cvss_score: 10.0, vuln_id: 'C2' },
      { severity: 'CRITICAL', cvss_score: 10.0, vuln_id: 'C3' },
      { severity: 'HIGH', vuln_id: 'H1' },
      { severity: 'HIGH', vuln_id: 'H2' },
    ];
    const result = calculateRisk(findings);
    assert.strictEqual(result.overallRiskScore, 100.00);
  });
});
