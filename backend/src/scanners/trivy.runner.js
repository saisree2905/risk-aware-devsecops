/**
 * Trivy CLI Runner
 * 
 * Safely executes Trivy vulnerability scans for filesystem, dependencies, and container images.
 * Uses child_process.execFile to prevent shell injection and bounds execution with timeouts.
 */

const { execFile } = require('child_process');
const path = require('path');
const { ScannerExecutionError } = require('./semgrep.runner');

const DEFAULT_TIMEOUT_MS = 90000;

/**
 * Runs Trivy filesystem scan against a directory.
 */
function runTrivyFs(targetPath, options = {}) {
  const binary = process.env.TRIVY_BIN || options.binary || 'trivy';
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const absoluteTarget = path.resolve(targetPath);

  const args = ['fs', '--format', 'json', '--quiet', absoluteTarget];
  return executeTrivy(binary, args, timeout, 'trivy-fs', absoluteTarget);
}

/**
 * Runs Trivy container image scan against an image tag (e.g. on CI runners).
 */
function runTrivyImage(imageTag, options = {}) {
  const binary = process.env.TRIVY_BIN || options.binary || 'trivy';
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const args = ['image', '--format', 'json', '--quiet', imageTag];
  return executeTrivy(binary, args, timeout, 'trivy-image', imageTag);
}

function executeTrivy(binary, args, timeout, scanType, target) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout, maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
      const executionTimeMs = Date.now() - startTime;

      if (err) {
        if (err.code === 'ENOENT') {
          return reject(new ScannerExecutionError(
            `Trivy executable not found: '${binary}'. Ensure it is installed and in PATH.`,
            'TOOL_NOT_INSTALLED',
            { binary, target, scanType }
          ));
        }

        if (err.killed || err.signal === 'SIGTERM') {
          return reject(new ScannerExecutionError(
            `Trivy scan timed out after ${timeout}ms.`,
            'EXECUTION_TIMEOUT',
            { timeout, executionTimeMs, scanType }
          ));
        }

        // Trivy may exit non-zero on scan findings if configured with --exit-code,
        // but if JSON output is intact, parse it.
        if (stdout && stdout.trim().startsWith('{')) {
          return resolve({
            stdout,
            executionTimeMs,
            exitCode: err.code || 0,
            version: 'trivy-cli',
            scanType,
          });
        }

        return reject(new ScannerExecutionError(
          `Trivy ${scanType} execution failed: ${stderr || err.message}`,
          'EXECUTION_FAILED',
          { exitCode: err.code, stderr, executionTimeMs, scanType }
        ));
      }

      resolve({
        stdout,
        executionTimeMs,
        exitCode: 0,
        version: 'trivy-cli',
        scanType,
      });
    });
  });
}

module.exports = {
  runTrivyFs,
  runTrivyImage,
  executeTrivy,
};
