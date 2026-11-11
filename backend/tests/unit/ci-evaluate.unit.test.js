const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseArgs, loadReport, evaluateDecision, run } = require('../../src/cli/ci-evaluate');

describe('Unit Tests: CI Evaluation CLI (ci-evaluate.js)', () => {
  const tmpDir = path.resolve(__dirname, '../fixtures/tmp_ci_test');

  // Setup sample valid fixture paths
  const semgrepFixturePath = path.resolve(__dirname, '../fixtures/semgrep-sample.json');
  const trivyFixturePath = path.resolve(__dirname, '../fixtures/trivy-sample.json');

  test('parseArgs parses CLI flags correctly over defaults', () => {
    const argv = [
      'node',
      'ci-evaluate.js',
      '--api-url', 'https://api.example.com',
      '--api-key', 'secret_key_123',
      '--commit', 'abcdef1234567890',
      '--branch', 'feature/test',
      '--trigger', 'pull_request',
      '--semgrep', './semgrep.json',
      '--trivy-fs', './trivy-fs.json',
      '--trivy-image', './trivy-img.json',
    ];

    const parsed = parseArgs(argv);
    assert.strictEqual(parsed.apiUrl, 'https://api.example.com');
    assert.strictEqual(parsed.apiKey, 'secret_key_123');
    assert.strictEqual(parsed.commitHash, 'abcdef1234567890');
    assert.strictEqual(parsed.branch, 'feature/test');
    assert.strictEqual(parsed.triggerEvent, 'pull_request');
    assert.strictEqual(parsed.semgrepReport, './semgrep.json');
    assert.strictEqual(parsed.trivyFsReport, './trivy-fs.json');
    assert.strictEqual(parsed.trivyImageReport, './trivy-img.json');
  });

  test('loadReport successfully reads and parses valid JSON file', () => {
    const report = loadReport(semgrepFixturePath, 'semgrep');
    assert.ok(report);
    assert.ok(Array.isArray(report.results));
  });

  test('loadReport throws error for non-existent report file', () => {
    assert.throws(
      () => loadReport('./non_existent_report_123.json', 'trivy_fs'),
      /Report file for trivy_fs not found at/
    );
  });

  test('loadReport throws error for malformed JSON report file', () => {
    const malformedPath = path.resolve(__dirname, '../fixtures/malformed-temp.json');
    fs.writeFileSync(malformedPath, '{ "results": [ not valid json');
    try {
      assert.throws(
        () => loadReport(malformedPath, 'semgrep'),
        /contains invalid JSON/
      );
    } finally {
      if (fs.existsSync(malformedPath)) fs.unlinkSync(malformedPath);
    }
  });

  test('evaluateDecision: PASS produces exitCode 0', () => {
    const result = evaluateDecision({
      scanId: '11111111-2222-3333-4444-555555555555',
      scanStatus: 'COMPLETED',
      normalizedFindingCount: 0,
      riskAssessment: { overallRiskScore: 0.0, criticalCount: 0 },
      pipelineDecision: {
        decision: 'PASS',
        isBlocking: false,
        decisionRationale: 'Clean scan under all thresholds',
      },
    });

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.decision, 'PASS');
  });

  test('evaluateDecision: WARN produces exitCode 0 and non-blocking status', () => {
    const result = evaluateDecision({
      scanId: '11111111-2222-3333-4444-555555555555',
      scanStatus: 'COMPLETED',
      normalizedFindingCount: 2,
      riskAssessment: { overallRiskScore: 42.0, criticalCount: 0 },
      pipelineDecision: {
        decision: 'WARN',
        isBlocking: false,
        decisionRationale: 'Risk score crosses warn threshold',
      },
    });

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.decision, 'WARN');
  });

  test('evaluateDecision: BLOCK produces exitCode 1 (blocking failure)', () => {
    const result = evaluateDecision({
      scanId: '11111111-2222-3333-4444-555555555555',
      scanStatus: 'COMPLETED',
      normalizedFindingCount: 5,
      riskAssessment: { overallRiskScore: 85.0, criticalCount: 2 },
      pipelineDecision: {
        decision: 'BLOCK',
        isBlocking: true,
        decisionRationale: 'Critical finding limit exceeded',
      },
    });

    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.decision, 'BLOCK');
  });

  test('evaluateDecision: FAILED scan status produces exitCode 1', () => {
    const result = evaluateDecision({
      scanId: '11111111-2222-3333-4444-555555555555',
      scanStatus: 'FAILED',
      pipelineDecision: {
        decision: 'BLOCK',
        isBlocking: true,
        decisionRationale: 'Scanner execution failure',
      },
      errors: [{ scanner: 'semgrep', error: 'Scanner timed out' }],
    });

    assert.strictEqual(result.exitCode, 1);
  });

  test('evaluateDecision: Unknown decision fails closed with exitCode 1', () => {
    const result = evaluateDecision({
      scanId: '11111111-2222-3333-4444-555555555555',
      scanStatus: 'COMPLETED',
      pipelineDecision: {
        decision: 'INDETERMINATE',
        isBlocking: false,
      },
    });

    assert.strictEqual(result.exitCode, 1);
  });

  test('run() fails closed with code 1 when API_URL is missing', async () => {
    const code = await run(['node', 'ci-evaluate.js', '--api-key', 'secret', '--commit', '1234567', '--branch', 'main']);
    assert.strictEqual(code, 1);
  });

  test('run() fails closed with code 1 when API_KEY is missing', async () => {
    const code = await run(['node', 'ci-evaluate.js', '--api-url', 'http://localhost', '--commit', '1234567', '--branch', 'main']);
    assert.strictEqual(code, 1);
  });

  test('run() fails closed with code 1 when a scanner report file is missing', async () => {
    const code = await run([
      'node', 'ci-evaluate.js',
      '--api-url', 'http://localhost',
      '--api-key', 'key',
      '--commit', '1234567',
      '--branch', 'main',
      '--semgrep', semgrepFixturePath,
      '--trivy-fs', trivyFixturePath,
      '--trivy-image', './missing_image_report.json',
    ]);
    assert.strictEqual(code, 1);
  });

  test('run() submits payload to API and returns exitCode 0 on PASS response', async () => {
    // Create temporary trivy image report
    const dummyImgReport = path.resolve(__dirname, '../fixtures/dummy-img.json');
    fs.writeFileSync(dummyImgReport, JSON.stringify({ SchemaVersion: 2, Results: [] }));

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, opts) => {
        assert.ok(url.endsWith('/api/scans/ingest'));
        assert.strictEqual(opts.headers['x-api-key'], 'test-api-key-ci');

        const body = JSON.parse(opts.body);
        assert.strictEqual(body.commitHash, 'abcdef1234567890');
        assert.strictEqual(body.branch, 'main');
        assert.ok(body.scannerPayloads.semgrep);
        assert.ok(body.scannerPayloads.trivy_fs);
        assert.ok(body.scannerPayloads.trivy_image);

        return {
          status: 201,
          json: async () => ({
            status: 'success',
            data: {
              scanId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              scanStatus: 'COMPLETED',
              normalizedFindingCount: 0,
              riskAssessment: { overallRiskScore: 0.0, criticalCount: 0 },
              pipelineDecision: { decision: 'PASS', isBlocking: false, decisionRationale: 'Clean' },
            },
          }),
        };
      };

      const code = await run([
        'node', 'ci-evaluate.js',
        '--api-url', 'https://api.devsecops.local',
        '--api-key', 'test-api-key-ci',
        '--commit', 'abcdef1234567890',
        '--branch', 'main',
        '--semgrep', semgrepFixturePath,
        '--trivy-fs', trivyFixturePath,
        '--trivy-image', dummyImgReport,
      ]);

      assert.strictEqual(code, 0);
    } finally {
      globalThis.fetch = originalFetch;
      if (fs.existsSync(dummyImgReport)) fs.unlinkSync(dummyImgReport);
    }
  });

  test('run() fails closed with code 1 when network connection fails', async () => {
    const dummyImgReport = path.resolve(__dirname, '../fixtures/dummy-img.json');
    fs.writeFileSync(dummyImgReport, JSON.stringify({ SchemaVersion: 2, Results: [] }));

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:5000');
      };

      const code = await run([
        'node', 'ci-evaluate.js',
        '--api-url', 'http://127.0.0.1:5000',
        '--api-key', 'test-api-key-ci',
        '--commit', 'abcdef1234567890',
        '--branch', 'main',
        '--semgrep', semgrepFixturePath,
        '--trivy-fs', trivyFixturePath,
        '--trivy-image', dummyImgReport,
      ]);

      assert.strictEqual(code, 1);
    } finally {
      globalThis.fetch = originalFetch;
      if (fs.existsSync(dummyImgReport)) fs.unlinkSync(dummyImgReport);
    }
  });
});
