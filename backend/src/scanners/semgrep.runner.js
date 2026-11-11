/**
 * Semgrep CLI Runner
 * 
 * Safely executes Semgrep SAST scans using child_process.execFile.
 * Prevents arbitrary shell interpolation and enforces process timeouts.
 */

const { execFile } = require('child_process');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 60000;

class ScannerExecutionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ScannerExecutionError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Executes Semgrep CLI against target directory.
 * 
 * @param {string} targetPath - Directory path to scan
 * @param {object} options - Optional execution overrides
 * @returns {Promise<{ stdout: string, executionTimeMs: number, exitCode: number, version: string }>}
 */
function runSemgrep(targetPath, options = {}) {
  const binary = process.env.SEMGREP_BIN || options.binary || 'semgrep';
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const config = options.config || 'auto';

  const absoluteTarget = path.resolve(targetPath);
  const args = ['scan', '--json', '--quiet', `--config=${config}`, absoluteTarget];

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const executionTimeMs = Date.now() - startTime;

      if (err) {
        if (err.code === 'ENOENT') {
          return reject(new ScannerExecutionError(
            `Semgrep executable not found: '${binary}'. Ensure it is installed and in PATH.`,
            'TOOL_NOT_INSTALLED',
            { binary, targetPath: absoluteTarget }
          ));
        }

        if (err.killed || err.signal === 'SIGTERM') {
          return reject(new ScannerExecutionError(
            `Semgrep scan timed out after ${timeout}ms.`,
            'EXECUTION_TIMEOUT',
            { timeout, executionTimeMs }
          ));
        }

        // Semgrep returns exit code 1 when findings are present in some configurations,
        // or code 0. If stdout contains valid JSON despite non-zero exit code, consider output.
        if (stdout && stdout.trim().startsWith('{')) {
          return resolve({
            stdout,
            executionTimeMs,
            exitCode: err.code || 0,
            version: 'semgrep-cli',
          });
        }

        return reject(new ScannerExecutionError(
          `Semgrep execution failed: ${stderr || err.message}`,
          'EXECUTION_FAILED',
          { exitCode: err.code, stderr, executionTimeMs }
        ));
      }

      resolve({
        stdout,
        executionTimeMs,
        exitCode: 0,
        version: 'semgrep-cli',
      });
    });
  });
}

module.exports = {
  runSemgrep,
  ScannerExecutionError,
};
