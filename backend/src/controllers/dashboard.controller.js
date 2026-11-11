const db = require('../database');

/**
 * Dashboard Statistics Controller
 *
 * Provides aggregated metrics, latest scan summary, decision breakdowns,
 * and active policy metadata for the executive overview dashboard.
 */
async function getDashboardStats(req, res, next) {
  try {
    // 1. Total and status counts
    const scanCountsQuery = `
      SELECT
        COUNT(*) AS total_scans,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_scans,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_scans,
        COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) AS running_scans
      FROM scans;
    `;
    const scanCountsRes = await db.query(scanCountsQuery);
    const scanCounts = scanCountsRes.rows[0] || {};

    // 2. Decision breakdown across completed scans
    const decisionQuery = `
      SELECT
        COUNT(CASE WHEN decision = 'PASS' THEN 1 END) AS pass_count,
        COUNT(CASE WHEN decision = 'WARN' THEN 1 END) AS warn_count,
        COUNT(CASE WHEN decision = 'BLOCK' THEN 1 END) AS block_count
      FROM pipeline_decisions;
    `;
    const decisionRes = await db.query(decisionQuery);
    const decisionCounts = decisionRes.rows[0] || {};

    // 3. Latest completed scan summary
    const latestScanQuery = `
      SELECT
        s.id, s.commit_hash, s.branch, s.trigger_event, s.status, s.initiated_by,
        s.created_at, s.completed_at,
        ra.overall_risk_score, ra.critical_count, ra.high_count, ra.medium_count,
        ra.low_count, ra.info_count, ra.assessment_rationale,
        pd.decision, pd.is_blocking, pd.decision_rationale, pd.evaluated_at,
        (SELECT COUNT(*) FROM security_findings sf WHERE sf.scan_id = s.id) AS total_findings
      FROM scans s
      LEFT JOIN risk_assessments ra ON ra.scan_id = s.id
      LEFT JOIN pipeline_decisions pd ON pd.scan_id = s.id
      WHERE s.status = 'COMPLETED'
      ORDER BY s.created_at DESC
      LIMIT 1;
    `;
    const latestScanRes = await db.query(latestScanQuery);
    const latestScan = latestScanRes.rows[0] || null;

    // 4. Active policy metadata
    const activePolicyQuery = `
      SELECT
        id, name, version, description,
        max_critical_count, max_high_count, max_risk_score, warn_risk_score, fail_on_block
      FROM policies
      WHERE is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const activePolicyRes = await db.query(activePolicyQuery);
    const activePolicy = activePolicyRes.rows[0] || null;

    // 5. Overall findings count and severity totals
    const findingsQuery = `
      SELECT
        COUNT(*) AS total_findings,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) AS critical_count,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) AS high_count,
        COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) AS medium_count,
        COUNT(CASE WHEN severity = 'LOW' THEN 1 END) AS low_count,
        COUNT(CASE WHEN severity = 'INFO' THEN 1 END) AS info_count
      FROM security_findings;
    `;
    const findingsRes = await db.query(findingsQuery);
    const findingsCounts = findingsRes.rows[0] || {};

    return res.status(200).json({
      status: 'success',
      data: {
        scans: {
          total: parseInt(scanCounts.total_scans || 0, 10),
          completed: parseInt(scanCounts.completed_scans || 0, 10),
          failed: parseInt(scanCounts.failed_scans || 0, 10),
          running: parseInt(scanCounts.running_scans || 0, 10),
        },
        decisions: {
          pass: parseInt(decisionCounts.pass_count || 0, 10),
          warn: parseInt(decisionCounts.warn_count || 0, 10),
          block: parseInt(decisionCounts.block_count || 0, 10),
        },
        findings: {
          total: parseInt(findingsCounts.total_findings || 0, 10),
          critical: parseInt(findingsCounts.critical_count || 0, 10),
          high: parseInt(findingsCounts.high_count || 0, 10),
          medium: parseInt(findingsCounts.medium_count || 0, 10),
          low: parseInt(findingsCounts.low_count || 0, 10),
          info: parseInt(findingsCounts.info_count || 0, 10),
        },
        latestScan,
        activePolicy,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
};
