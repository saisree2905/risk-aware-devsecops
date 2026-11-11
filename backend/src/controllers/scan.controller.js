const db = require('../database');
const orchestratorService = require('../services/orchestrator.service');
const { validateIngestPayload } = require('../validators/scan.validator');
const {
  isValidUuid,
  parsePagination,
  validateScanFilters,
  validateFindingFilters,
} = require('../validators/query.validator');

/**
 * Scan Ingestion Controller
 *
 * Handles incoming scan reports from CI/CD pipelines:
 * 1. Validates scan metadata and scanner JSON payloads.
 * 2. Creates a new scan record in Supabase.
 * 3. Delegates normalization, risk scoring, and policy gating to `orchestrateScan`.
 * 4. Returns deterministic pipeline decision and assessment summary.
 *
 * NOTE: Strictly protected by apiKeyAuth middleware (server-to-server).
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
 * Retrieve scan assessment and decision summary by scan ID
 * Public read-only endpoint (used by tests and lightweight lookups)
 */
async function getScanById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
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

/**
 * Retrieve paginated and filterable list of scans
 * GET /api/scans?page=1&limit=20&decision=WARN&status=COMPLETED&branch=main
 */
async function getScansList(req, res, next) {
  try {
    const filterValidation = validateScanFilters(req.query);
    if (!filterValidation.valid) {
      return res.status(400).json({
        status: 'fail',
        message: filterValidation.errors.join('; '),
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const { filters } = filterValidation;

    const whereClauses = [];
    const params = [];

    if (filters.decision) {
      params.push(filters.decision);
      whereClauses.push(`pd.decision = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      whereClauses.push(`s.status = $${params.length}`);
    }

    if (filters.branch) {
      params.push(filters.branch);
      whereClauses.push(`s.branch = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count for pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM scans s
      LEFT JOIN pipeline_decisions pd ON pd.scan_id = s.id
      ${whereSql};
    `;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || 0, 10);

    // Data query
    const dataSql = `
      SELECT
        s.id, s.commit_hash, s.branch, s.trigger_event, s.status, s.initiated_by,
        s.created_at, s.completed_at,
        ra.overall_risk_score, ra.critical_count, ra.high_count, ra.medium_count,
        ra.low_count, ra.info_count,
        pd.decision, pd.is_blocking, pd.decision_rationale, pd.evaluated_at,
        (SELECT COUNT(*) FROM security_findings sf WHERE sf.scan_id = s.id) AS total_findings
      FROM scans s
      LEFT JOIN risk_assessments ra ON ra.scan_id = s.id
      LEFT JOIN pipeline_decisions pd ON pd.scan_id = s.id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const dataRes = await db.query(dataSql, [...params, limit, offset]);

    return res.status(200).json({
      status: 'success',
      data: {
        scans: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve comprehensive details of a scan run (audit view)
 * GET /api/scans/:id/full
 */
async function getFullScanDetails(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid scan ID format. Must be a valid UUID.',
        timestamp: new Date().toISOString(),
      });
    }

    // 1. Scan with assessment, decision and policy
    const scanQuery = `
      SELECT
        s.id, s.commit_hash, s.branch, s.trigger_event, s.status, s.initiated_by,
        s.created_at, s.completed_at,
        ra.overall_risk_score, ra.critical_count, ra.high_count, ra.medium_count,
        ra.low_count, ra.info_count, ra.assessment_rationale, ra.calculated_at,
        pd.decision, pd.is_blocking, pd.decision_rationale, pd.evaluated_at,
        p.id AS policy_id, p.name AS policy_name, p.version AS policy_version,
        p.max_critical_count, p.max_high_count, p.max_risk_score, p.warn_risk_score, p.fail_on_block
      FROM scans s
      LEFT JOIN risk_assessments ra ON ra.scan_id = s.id
      LEFT JOIN pipeline_decisions pd ON pd.scan_id = s.id
      LEFT JOIN policies p ON pd.policy_id = p.id
      WHERE s.id = $1;
    `;
    const scanRes = await db.query(scanQuery, [id]);

    if (!scanRes.rows || scanRes.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `Scan record with ID '${id}' not found.`,
        timestamp: new Date().toISOString(),
      });
    }

    const scanData = scanRes.rows[0];

    // 2. Scanner executions / metadata
    const metaQuery = `
      SELECT scanner_name, scanner_version, execution_time_ms, exit_code, created_at
      FROM scanner_metadata
      WHERE scan_id = $1
      ORDER BY scanner_name;
    `;
    const metaRes = await db.query(metaQuery, [id]);

    // 3. Findings summary breakdown by scanner & severity
    const summaryQuery = `
      SELECT
        scanner_name, severity, COUNT(*) as count
      FROM security_findings
      WHERE scan_id = $1
      GROUP BY scanner_name, severity
      ORDER BY scanner_name, severity;
    `;
    const summaryRes = await db.query(summaryQuery, [id]);

    // 4. Total findings count
    const countQuery = `
      SELECT COUNT(*) AS total FROM security_findings WHERE scan_id = $1;
    `;
    const countRes = await db.query(countQuery, [id]);
    const totalFindings = parseInt(countRes.rows[0]?.total || 0, 10);

    return res.status(200).json({
      status: 'success',
      data: {
        scan: scanData,
        scannerExecutions: metaRes.rows,
        findingsSummary: summaryRes.rows,
        totalFindings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve paginated and filterable security findings for a scan
 * GET /api/scans/:id/findings?page=1&limit=50&severity=HIGH&scanner=semgrep&search=XSS
 *
 * NOTE: Returns strictly allowlisted fields. raw_payload is NEVER exposed.
 */
async function getScanFindings(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid scan ID format. Must be a valid UUID.',
        timestamp: new Date().toISOString(),
      });
    }

    const filterValidation = validateFindingFilters(req.query);
    if (!filterValidation.valid) {
      return res.status(400).json({
        status: 'fail',
        message: filterValidation.errors.join('; '),
        timestamp: new Date().toISOString(),
      });
    }

    // Verify scan exists
    const scanExistsRes = await db.query('SELECT id FROM scans WHERE id = $1', [id]);
    if (!scanExistsRes.rows || scanExistsRes.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `Scan record with ID '${id}' not found.`,
        timestamp: new Date().toISOString(),
      });
    }

    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const { filters } = filterValidation;

    const whereClauses = ['scan_id = $1'];
    const params = [id];

    if (filters.severity) {
      params.push(filters.severity);
      whereClauses.push(`severity = $${params.length}`);
    }

    if (filters.scanner) {
      params.push(filters.scanner);
      whereClauses.push(`(scanner_name = $${params.length} OR scanner_name LIKE $${params.length} || '%')`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      whereClauses.push(`(title ILIKE $${params.length} OR vuln_id ILIKE $${params.length} OR affected_component ILIKE $${params.length})`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Count matching findings
    const countSql = `SELECT COUNT(*) AS total FROM security_findings ${whereSql};`;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || 0, 10);

    // Allowlisted fields ONLY (raw_payload strictly excluded)
    const dataSql = `
      SELECT
        id, scan_id, scanner_name, finding_id, vuln_id,
        title, description, severity, cvss_score,
        affected_component, affected_version, fixed_version, remediation,
        created_at
      FROM security_findings
      ${whereSql}
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          WHEN 'INFO' THEN 5
          ELSE 6
        END,
        cvss_score DESC NULLS LAST,
        created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const dataRes = await db.query(dataSql, [...params, limit, offset]);

    return res.status(200).json({
      status: 'success',
      data: {
        scanId: id,
        findings: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestScan,
  getScanById,
  getScansList,
  getFullScanDetails,
  getScanFindings,
};
