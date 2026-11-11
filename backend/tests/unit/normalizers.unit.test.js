const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { normalizeSemgrepOutput, normalizeSemgrepSeverity } = require('../../src/normalizers/semgrep.normalizer');
const { normalizeTrivyOutput, normalizeTrivySeverity, extractTrivyCvss } = require('../../src/normalizers/trivy.normalizer');

describe('Unit Tests: Semgrep Normalizer', () => {
  test('Semgrep severity mapping: INFO -> INFO, WARNING -> MEDIUM, ERROR -> HIGH/CRITICAL', () => {
    assert.strictEqual(normalizeSemgrepSeverity('INFO'), 'INFO');
    assert.strictEqual(normalizeSemgrepSeverity('WARNING'), 'MEDIUM');
    assert.strictEqual(normalizeSemgrepSeverity('ERROR', {}), 'HIGH'); // conservative default
    assert.strictEqual(normalizeSemgrepSeverity('ERROR', { cwe: 'CWE-89', confidence: 'HIGH' }), 'CRITICAL'); // SQLi with high confidence is critical
    assert.strictEqual(normalizeSemgrepSeverity('ERROR', { impact: 'CRITICAL' }), 'CRITICAL');
  });

  test('Parses Semgrep fixture JSON correctly into normalized findings', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/semgrep-sample.json');
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const findings = normalizeSemgrepOutput(raw);

    assert.strictEqual(findings.length, 3);

    // Finding 1: SQL Injection
    const sqli = findings[0];
    assert.strictEqual(sqli.scanner_name, 'semgrep');
    assert.strictEqual(sqli.finding_id, 'javascript.express.security.audit.sqli-injection');
    assert.strictEqual(sqli.severity, 'CRITICAL');
    assert.strictEqual(sqli.cvss_score, 9.8);
    assert.strictEqual(sqli.affected_component, 'src/routes/user.js:42');
    assert.ok(sqli.title.includes('SQL query string concatenation'));

    // Finding 2: XSS Reflected (Warning -> MEDIUM)
    const xss = findings[1];
    assert.strictEqual(xss.severity, 'MEDIUM');
    assert.strictEqual(xss.cvss_score, 6.1);
    assert.strictEqual(xss.affected_component, 'src/views/profile.js:15');

    // Finding 3: Hardcoded Token (ERROR -> HIGH)
    const token = findings[2];
    assert.strictEqual(token.severity, 'HIGH');
    assert.strictEqual(token.cvss_score, 7.5);
  });

  test('Handles empty, malformed, or null Semgrep output gracefully', () => {
    assert.deepStrictEqual(normalizeSemgrepOutput(null), []);
    assert.deepStrictEqual(normalizeSemgrepOutput({ results: [] }), []);
    assert.throws(() => {
      normalizeSemgrepOutput('invalid-non-json');
    }, /Failed to parse Semgrep JSON output/);
  });
});

describe('Unit Tests: Trivy Normalizer', () => {
  test('Trivy severity and CVSS extraction logic', () => {
    assert.strictEqual(normalizeTrivySeverity('CRITICAL'), 'CRITICAL');
    assert.strictEqual(normalizeTrivySeverity('HIGH'), 'HIGH');
    assert.strictEqual(normalizeTrivySeverity('UNKNOWN'), 'INFO');

    // CVSS candidate priority: NVD > RedHat > GHSA
    const vuln = {
      CVSS: {
        redhat: { V3Score: 7.2 },
        nvd: { V3Score: 9.1 },
      },
    };
    assert.strictEqual(extractTrivyCvss(vuln), 9.1);

    // Out of bounds CVSS falls back safely to null
    const invalidVuln = {
      CVSS: { nvd: { V3Score: 12.5 } },
    };
    assert.strictEqual(extractTrivyCvss(invalidVuln), null);
  });

  test('Parses Trivy fixture JSON correctly into normalized findings', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/trivy-sample.json');
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const findings = normalizeTrivyOutput(raw);

    assert.strictEqual(findings.length, 3);

    const babel = findings[0];
    assert.strictEqual(babel.scanner_name, 'trivy');
    assert.strictEqual(babel.finding_id, 'CVE-2023-45133');
    assert.strictEqual(babel.vuln_id, 'CVE-2023-45133');
    assert.strictEqual(babel.severity, 'CRITICAL');
    assert.strictEqual(babel.cvss_score, 9.8);
    assert.strictEqual(babel.affected_component, 'babel-traverse@7.23.0 (package-lock.json)');
    assert.strictEqual(babel.fixed_version, '7.23.2');
    assert.strictEqual(babel.remediation, 'Upgrade babel-traverse to version 7.23.2 or later.');

    const cookie = findings[2];
    assert.strictEqual(cookie.severity, 'LOW');
    assert.strictEqual(cookie.cvss_score, 3.7);
  });

  test('Handles empty, malformed, or null Trivy output gracefully', () => {
    assert.deepStrictEqual(normalizeTrivyOutput(null), []);
    assert.deepStrictEqual(normalizeTrivyOutput({ Results: [] }), []);
    assert.throws(() => {
      normalizeTrivyOutput('malformed-json');
    }, /Failed to parse Trivy JSON output/);
  });
});
