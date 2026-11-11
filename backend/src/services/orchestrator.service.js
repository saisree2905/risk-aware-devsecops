/**
 * Scanner Orchestrator Service
 * 
 * Orchestrates multi-scanner executions (Semgrep, Trivy FS, Trivy Image),
 * records scanner performance & status in `scanner_metadata`, normalizes outputs,
 * and passes findings through the Phase 2 assessment service atomically.
 * 
 * Safety & Quality:
 * - A failed scanner NEVER produces a false clean/PASS scan.
 * - Partial scanner failures mark the scan as FAILED and report explicitly.
 */

const { query, withTransaction } = require('../database');
const { runSemgrep, ScannerExecutionError } = require('../scanners/semgrep.runner');
const { runTrivyFs, runTrivyImage } = require('../scanners/trivy.runner');
const { normalizeSemgrepOutput } = require('../normalizers/semgrep.normalizer');
const { normalizeTrivyOutput } = require('../normalizers/trivy.normalizer');
const { getActivePolicy } = require('./policy.service');
const { processScanAssessment } = require('./assessment.service');

async function recordScannerMetadata(client, { scanId, scannerName, version, executionTimeMs, exitCode }) {
  await client.query(
    `INSERT INTO scanner_metadata (
      scan_id, scanner_name, scanner_version, execution_time_ms, exit_code
    ) VALUES ($1, $2, $3, $4, $5)`,
    [scanId, scannerName, version || 'unknown', executionTimeMs || 0, exitCode || 0]
  );
}

/**
 * Orchestrates scanning for a given scan run.
 * 
 * @param {object} params
 * @param {string} params.scanId - Scan UUID
 * @param {string} params.targetPath - Target directory to scan
 * @param {string} [params.imageTag] - Optional container image tag for Trivy
 * @param {Array<string>} [params.scanners] - e.g. ['semgrep', 'trivy_fs', 'trivy_image']
 * @param {object} [params.policyOverride] - Optional policy object override
 * @param {object} [params.mockOutputs] - Optional pre-parsed/JSON strings for testing fixtures
 */
async function orchestrateScan({
  scanId,
  targetPath,
  imageTag = null,
  scanners = ['semgrep', 'trivy_fs'],
  policyOverride = null,
  mockOutputs = {},
}) {
  if (!scanId) throw new Error('scanId is required for scan orchestration.');

  // Update scan to RUNNING
  await query("UPDATE scans SET status = 'RUNNING' WHERE id = $1", [scanId]);

  const allNormalizedFindings = [];
  const scannerExecutions = [];
  const errors = [];

  for (const scannerType of scanners) {
    const startTime = Date.now();
    try {
      let rawOutput;
      let executionTimeMs = 0;
      let exitCode = 0;
      let version = 'cli';

      if (mockOutputs[scannerType]) {
        // Controlled test fixture injection
        rawOutput = mockOutputs[scannerType];
        executionTimeMs = 15;
        exitCode = 0;
        version = 'fixture-mock';
      } else if (scannerType === 'semgrep') {
        const res = await runSemgrep(targetPath);
        rawOutput = res.stdout;
        executionTimeMs = res.executionTimeMs;
        exitCode = res.exitCode;
        version = res.version;
      } else if (scannerType === 'trivy_fs') {
        const res = await runTrivyFs(targetPath);
        rawOutput = res.stdout;
        executionTimeMs = res.executionTimeMs;
        exitCode = res.exitCode;
        version = res.version;
      } else if (scannerType === 'trivy_image') {
        if (!imageTag) throw new Error('imageTag is required for trivy_image scanner.');
        const res = await runTrivyImage(imageTag);
        rawOutput = res.stdout;
        executionTimeMs = res.executionTimeMs;
        exitCode = res.exitCode;
        version = res.version;
      } else {
        throw new Error(`Unsupported scanner type: ${scannerType}`);
      }

      // Normalize findings
      let normalized = [];
      if (scannerType === 'semgrep') {
        normalized = normalizeSemgrepOutput(rawOutput);
      } else if (scannerType === 'trivy_fs' || scannerType === 'trivy_image') {
        normalized = normalizeTrivyOutput(rawOutput);
      }

      allNormalizedFindings.push(...normalized);
      scannerExecutions.push({
        scannerName: scannerType,
        version,
        executionTimeMs,
        exitCode,
        findingCount: normalized.length,
        status: 'SUCCESS',
      });
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      const exitCode = err.details?.exitCode || 1;
      const errMessage = err.message || 'Unknown scanner error';

      scannerExecutions.push({
        scannerName: scannerType,
        version: 'unknown',
        executionTimeMs,
        exitCode,
        findingCount: 0,
        status: 'FAILED',
        error: errMessage,
      });

      errors.push({ scanner: scannerType, error: errMessage, code: err.code });
    }
  }

  // Handle scanner failures safely and atomically
  if (errors.length > 0) {
    const errorSummary = errors.map((e) => `${e.scanner}: ${e.error}`).join('; ');
    const scannerNames = errors.map((e) => e.scanner).join(', ');
    const decisionRationale = `Pipeline halted: Required security scanner(s) failed execution (${scannerNames}). Incomplete security coverage cannot produce a clean assessment.`;

    let activePolicy = null;
    let policyConfigError = null;

    if (policyOverride) {
      activePolicy = policyOverride;
    } else {
      try {
        activePolicy = await getActivePolicy();
      } catch (pErr) {
        policyConfigError = pErr.message;
      }
    }

    const failureDecision = {
      decision: 'BLOCK',
      isBlocking: true,
      decisionRationale: policyConfigError
        ? `${decisionRationale} Note: Pipeline decision record could not be persisted in database due to policy configuration issue: ${policyConfigError}`
        : decisionRationale,
      policyId: activePolicy?.id || null,
      persistenceStatus: activePolicy ? 'PERSISTED' : 'UNAVAILABLE_POLICY_CONFIG',
    };

    // Persist scanner metadata, scan FAILED status, and synthetic BLOCK decision atomically
    await withTransaction(async (client) => {
      for (const exec of scannerExecutions) {
        await recordScannerMetadata(client, {
          scanId,
          scannerName: exec.scannerName,
          version: exec.version,
          executionTimeMs: exec.executionTimeMs,
          exitCode: exec.exitCode,
        });
      }

      await client.query(
        "UPDATE scans SET status = 'FAILED', completed_at = NOW() WHERE id = $1",
        [scanId]
      );

      if (activePolicy && activePolicy.id) {
        await client.query(
          `INSERT INTO pipeline_decisions (
            scan_id, policy_id, decision, decision_rationale, is_blocking
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (scan_id) DO UPDATE SET
            policy_id = EXCLUDED.policy_id,
            decision = EXCLUDED.decision,
            decision_rationale = EXCLUDED.decision_rationale,
            is_blocking = EXCLUDED.is_blocking,
            evaluated_at = NOW();`,
          [
            scanId,
            activePolicy.id,
            'BLOCK',
            decisionRationale,
            true,
          ]
        );
      }
    });

    return {
      scanId,
      status: 'FAILED',
      scannerExecutions,
      errors,
      message: `Scanner orchestration failed: ${errorSummary}`,
      riskAssessment: null,
      pipelineDecision: failureDecision,
    };
  }

  // Persist scanner execution metadata in Supabase for successful runs
  await withTransaction(async (client) => {
    for (const exec of scannerExecutions) {
      await recordScannerMetadata(client, {
        scanId,
        scannerName: exec.scannerName,
        version: exec.version,
        executionTimeMs: exec.executionTimeMs,
        exitCode: exec.exitCode,
      });
    }
  });

  // Pass normalized findings to existing Phase 2 assessment service atomically
  const assessmentResult = await processScanAssessment({
    scanId,
    findings: allNormalizedFindings,
    policyOverride,
  });

  return {
    scanId,
    status: 'COMPLETED',
    scannerExecutions,
    normalizedFindingCount: allNormalizedFindings.length,
    ...assessmentResult,
  };
}

module.exports = {
  orchestrateScan,
  recordScannerMetadata,
};
