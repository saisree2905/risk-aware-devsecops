const db = require('../database');
const orchestratorService = require('../services/orchestrator.service');
const { validateIngestPayload } = require('../validators/scan.validator');

/**
 * Scan Ingestion Controller
 *
 * Handles incoming scan reports from CI/CD pipelines:
 * 1. Validates scan metadata and scanner JSON payloads.
 * 2. Creates a new scan record in Supabase (or reuses scanId if explicitly provided for idempotency).
 * 3. Delegates normalization, risk scoring, and policy gating to `orchestrateScan`.
 * 4. Returns deterministic pipeline decision and assessment summary.
 */
async function ingestScan(req, res, next) {
  try {
    const validation = validateIngestPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'fail',
        message: validation.message,
        timestamp: new Date().toISOString(),
      });
    }

    const { commitHash, branch, triggerEvent, initiatedBy, scannerPayloads } = validation.data;
    const activeScanners = Object.keys(scannerPayloads);

    // Create an initial scan record in Supabase
    const insertSql = `
      INSERT INTO scans (commit_hash, branch, trigger_event, status, initiated_by)
      VALUES ($1, $2, $3, 'PENDING', $4)
      RETURNING id, created_at;
    `;
    const { rows } = await db.query(insertSql, [commitHash, branch, triggerEvent, initiatedBy]);
    const scanId = rows[0].id;

    // Delegate execution to existing orchestrator with injected mockOutputs
    const orchestratorResult = await orchestratorService.orchestrateScan({
      scanId,
      targetPath: '.',
      scanners: activeScanners,
      mockOutputs: scannerPayloads,
    });

    const isFailed = orchestratorResult.status === 'FAILED';
    const statusCode = isFailed ? 422 : 201;

    return res.status(statusCode).json({
      status: isFailed ? 'fail' : 'success',
      data: {
        scanId,
        scanStatus: orchestratorResult.status,
        normalizedFindingCount: orchestratorResult.normalizedFindingCount || 0,
        riskAssessment: orchestratorResult.riskAssessment,
        pipelineDecision: orchestratorResult.pipelineDecision,
        scannerExecutions: orchestratorResult.scannerExecutions,
        errors: orchestratorResult.errors || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve scan assessment and decision by scan ID
 */
async function getScanById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid scan ID format. Must be a valid UUID.',
        timestamp: new Date().toISOString(),
      });
    }

    const scanQuery = `
      SELECT s.id, s.commit_hash, s.branch, s.trigger_event, s.status, s.initiated_by,
             s.created_at, s.completed_at,
             ra.overall_risk_score, ra.critical_count, ra.high_count, ra.medium_count,
             ra.low_count, ra.info_count, ra.assessment_rationale,
             pd.decision, pd.is_blocking, pd.decision_rationale, pd.evaluated_at
      FROM scans s
      LEFT JOIN risk_assessments ra ON ra.scan_id = s.id
      LEFT JOIN pipeline_decisions pd ON pd.scan_id = s.id
      WHERE s.id = $1;
    `;
    const { rows } = await db.query(scanQuery, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `Scan record with ID '${id}' not found.`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'success',
      data: rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestScan,
  getScanById,
};
