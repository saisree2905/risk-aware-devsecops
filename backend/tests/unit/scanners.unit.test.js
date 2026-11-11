const { test, describe } = require('node:test');
const assert = require('node:assert');
const { runSemgrep, ScannerExecutionError } = require('../../src/scanners/semgrep.runner');
const { runTrivyFs } = require('../../src/scanners/trivy.runner');

describe('Unit Tests: Scanner Runner Error & Timeout Handling', () => {
  test('Missing Semgrep binary throws TOOL_NOT_INSTALLED ScannerExecutionError', async () => {
    await assert.rejects(
      async () => {
        await runSemgrep('.', { binary: 'non_existent_semgrep_binary_xyz123' });
      },
      (err) => {
        assert.strictEqual(err.name, 'ScannerExecutionError');
        assert.strictEqual(err.code, 'TOOL_NOT_INSTALLED');
        assert.ok(err.message.includes('Semgrep executable not found'));
        return true;
      }
    );
  });

  test('Missing Trivy binary throws TOOL_NOT_INSTALLED ScannerExecutionError', async () => {
    await assert.rejects(
      async () => {
        await runTrivyFs('.', { binary: 'non_existent_trivy_binary_xyz123' });
      },
      (err) => {
        assert.strictEqual(err.name, 'ScannerExecutionError');
        assert.strictEqual(err.code, 'TOOL_NOT_INSTALLED');
        assert.ok(err.message.includes('Trivy executable not found'));
        return true;
      }
    );
  });
});
