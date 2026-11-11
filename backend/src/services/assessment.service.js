/**
 * Assessment Service
 * 
 * Coordinates risk evaluation, policy determination, and atomic transactional persistence
 * into Supabase PostgreSQL (security_findings, risk_assessments, pipeline_decisions).
 */

const { withTransaction } = require('../database');
const { calculateRisk } = require('../risk-engine');
const { evaluatePolicy } = require('../policy-engine');
const { getActivePolicy } = require('./policy.service');

/**
 * Evaluates scan findings and persists findings, assessment, and decision atomically.
 */
async function processScanAssessment({ scanId, findings = [], policyOverride = null }) {
  if (!scanId) {
    throw new Error('scanId is required to process assessment.');
  }

  // 1. Resolve policy
  const policy = policyOverride || (await getActivePolicy());

  // 2. Compute deterministic risk
  const riskAssessment = calculateRisk(findings);

  // 3. Evaluate policy
  const pipelineDecision = evaluatePolicy(riskAssessment, policy);

  // 4. Atomic database persistence
  await withTransaction(async (client) => {
    // A. Insert normalized findings (if any)
    for (const f of findings) {
      await client.query(
        `INSERT INTO security_findings (
          scan_id, scanner_name, finding_id, vuln_id, title, description,
          severity, cvss_score, affected_component, affected_version,
          fixed_version, remediation, raw_payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          scanId,
          f.scanner_name || f.scannerName || 'unknown',
          f.finding_id || f.findingId || null,
          f.vuln_id || f.vulnId || null,
          f.title || 'Untitled Security Finding',
          f.description || null,
          (f.severity || 'INFO').toUpperCase(),
          f.cvss_score ?? f.cvssScore ?? null,
          f.affected_component || f.affectedComponent || 'unknown',
          f.affected_version || f.affectedVersion || null,
          f.fixed_version || f.fixedVersion || null,
          f.remediation || null,
          f.raw_payload ? JSON.stringify(f.raw_payload) : null,
        ]
      );
    }

    // B. Insert risk assessment record
    await client.query(
      `INSERT INTO risk_assessments (
        scan_id, overall_risk_score, critical_count, high_count,
        medium_count, low_count, info_count, assessment_rationale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (scan_id) DO UPDATE SET
        overall_risk_score = EXCLUDED.overall_risk_score,
        critical_count = EXCLUDED.critical_count,
        high_count = EXCLUDED.high_count,
        medium_count = EXCLUDED.medium_count,
        low_count = EXCLUDED.low_count,
        info_count = EXCLUDED.info_count,
        assessment_rationale = EXCLUDED.assessment_rationale,
        calculated_at = NOW()`,
      [
        scanId,
        riskAssessment.overallRiskScore,
        riskAssessment.counts.critical_count,
        riskAssessment.counts.high_count,
        riskAssessment.counts.medium_count,
        riskAssessment.counts.low_count,
        riskAssessment.counts.info_count,
        riskAssessment.assessmentRationale,
      ]
    );

    // C. Insert pipeline decision record
    await client.query(
      `INSERT INTO pipeline_decisions (
        scan_id, policy_id, decision, decision_rationale, is_blocking
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (scan_id) DO UPDATE SET
        policy_id = EXCLUDED.policy_id,
        decision = EXCLUDED.decision,
        decision_rationale = EXCLUDED.decision_rationale,
        is_blocking = EXCLUDED.is_blocking,
        evaluated_at = NOW()`,
      [
        scanId,
        pipelineDecision.policyId,
        pipelineDecision.decision,
        pipelineDecision.decisionRationale,
        pipelineDecision.isBlocking,
      ]
    );

    // D. Update scan status to COMPLETED
    await client.query(
      `UPDATE scans SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
      [scanId]
    );
  });

  return {
    scanId,
    riskAssessment,
    pipelineDecision,
    policyUsed: {
      id: policy.id,
      name: policy.name,
      version: policy.version,
    },
  };
}

module.exports = {
  processScanAssessment,
};
