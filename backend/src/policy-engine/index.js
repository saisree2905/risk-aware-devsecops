/**
 * Policy Evaluation Engine
 * 
 * Evaluates risk assessments against configurable security policies.
 * Determines PASS, WARN, or BLOCK decisions, independent of pipeline enforcement (fail_on_block).
 */

class PolicyConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyConfigurationError';
  }
}

/**
 * Evaluates an assessment against a provided security policy object.
 * 
 * Rules:
 * 1. BLOCK:
 *    - critical_count > max_critical_count OR
 *    - high_count > max_high_count OR
 *    - overall_risk_score >= max_risk_score
 * 2. WARN:
 *    - (Not BLOCK) AND (high_count > 0 OR overall_risk_score >= warn_risk_score OR medium_count > 5)
 * 3. PASS:
 *    - Otherwise
 * 
 * Pipeline enforcement:
 * is_blocking is true if decision === 'BLOCK' and policy.fail_on_block === true.
 */
function evaluatePolicy(assessment, policy) {
  if (!policy) {
    throw new PolicyConfigurationError('Cannot evaluate policy: Policy object is required.');
  }

  const maxCritical = Number(policy.max_critical_count ?? 0);
  const maxHigh = Number(policy.max_high_count ?? 2);
  const maxRiskScore = Number(policy.max_risk_score ?? 70.0);
  const warnRiskScore = Number(policy.warn_risk_score ?? 40.0);
  const failOnBlock = policy.fail_on_block !== false; // default true

  const critCount = Number(assessment.counts?.critical_count ?? 0);
  const highCount = Number(assessment.counts?.high_count ?? 0);
  const medCount = Number(assessment.counts?.medium_count ?? 0);
  const score = Number(assessment.overallRiskScore ?? 0);

  const blockReasons = [];
  const warnReasons = [];

  // 1. Evaluate BLOCK criteria
  if (critCount > maxCritical) {
    blockReasons.push(`Critical vulnerability count (${critCount}) exceeds policy ceiling of ${maxCritical}`);
  }
  if (highCount > maxHigh) {
    blockReasons.push(`High vulnerability count (${highCount}) exceeds policy ceiling of ${maxHigh}`);
  }
  if (score >= maxRiskScore) {
    blockReasons.push(`Overall risk score (${score.toFixed(2)}) meets or exceeds policy blocking threshold (${maxRiskScore.toFixed(2)})`);
  }

  if (blockReasons.length > 0) {
    const isBlocking = failOnBlock;
    const rationale = `Policy BLOCK triggered: ${blockReasons.join('; ')}. Enforcement is ${isBlocking ? 'ACTIVE (pipeline job fails)' : 'ADVISORY (fail_on_block disabled)'}. Policy: ${policy.name} (v${policy.version}).`;
    return {
      decision: 'BLOCK',
      isBlocking,
      decisionRationale: rationale,
      evaluatedRules: {
        maxCritical,
        maxHigh,
        maxRiskScore,
        warnRiskScore,
        failOnBlock,
      },
      policyId: policy.id,
    };
  }

  // 2. Evaluate WARN criteria
  if (highCount > 0) {
    warnReasons.push(`High vulnerability count (${highCount}) requires review under policy ceiling of ${maxHigh}`);
  }
  if (score >= warnRiskScore) {
    warnReasons.push(`Overall risk score (${score.toFixed(2)}) meets or exceeds warning threshold (${warnRiskScore.toFixed(2)})`);
  }
  if (medCount > 5) {
    warnReasons.push(`Medium vulnerability count (${medCount}) exceeds standard warning volume (5)`);
  }

  if (warnReasons.length > 0) {
    const rationale = `Policy WARN issued: ${warnReasons.join('; ')}. Pipeline allowed to proceed with non-blocking advisory warnings. Policy: ${policy.name} (v${policy.version}).`;
    return {
      decision: 'WARN',
      isBlocking: false,
      decisionRationale: rationale,
      evaluatedRules: {
        maxCritical,
        maxHigh,
        maxRiskScore,
        warnRiskScore,
        failOnBlock,
      },
      policyId: policy.id,
    };
  }

  // 3. PASS
  const rationale = `Policy PASS: All findings (${critCount} critical, ${highCount} high, ${medCount} medium) and risk score (${score.toFixed(2)}) are within approved security thresholds. Policy: ${policy.name} (v${policy.version}).`;
  return {
    decision: 'PASS',
    isBlocking: false,
    decisionRationale: rationale,
    evaluatedRules: {
      maxCritical,
      maxHigh,
      maxRiskScore,
      warnRiskScore,
      failOnBlock,
    },
    policyId: policy.id,
  };
}

module.exports = {
  evaluatePolicy,
  PolicyConfigurationError,
};
