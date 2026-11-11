/**
 * Risk Assessment Engine
 * 
 * Deterministic Heuristic Risk Scoring for DevSecOps Pipelines.
 * Computes explainable, bounded [0.00, 100.00] risk scores based on finding severity,
 * modulated by CVSS score with strict severity floor protection.
 */

const SEVERITY_WEIGHTS = {
  CRITICAL: 90.0,
  HIGH: 70.0,
  MEDIUM: 40.0,
  LOW: 15.0,
  INFO: 0.0,
};

const SEVERITY_RANK = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const COMPOUND_BONUS_WEIGHTS = {
  CRITICAL: 5.0,
  HIGH: 3.0,
  MEDIUM: 1.5,
  LOW: 0.5,
  INFO: 0.0,
};

/**
 * Validates and sanitizes CVSS value.
 * Missing, null, NaN or out-of-range (<0 or >10) values fall back to null.
 */
function parseValidCvss(cvss) {
  if (cvss === null || cvss === undefined || cvss === '') return null;
  const num = Number(cvss);
  if (Number.isNaN(num) || num < 0.0 || num > 10.0) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Calculates deterministic risk score for a single normalized finding.
 * 
 * Severity is primary indicator.
 * Floor protection: r_i >= 0.85 * w_sev (prevents silent downgrade on conflicting low CVSS).
 */
function calculateFindingScore(finding) {
  const severity = (finding.severity || 'INFO').toUpperCase();
  const baseWeight = SEVERITY_WEIGHTS[severity] ?? SEVERITY_WEIGHTS.INFO;
  const validCvss = parseValidCvss(finding.cvss_score ?? finding.cvssScore);

  let score;
  let cvssUsed = false;
  let floorApplied = false;

  if (validCvss !== null) {
    const scaledCvss = validCvss * 10;
    const blended = (0.70 * baseWeight) + (0.30 * scaledCvss);
    const floor = 0.85 * baseWeight;

    if (blended < floor) {
      score = floor;
      floorApplied = true;
    } else {
      score = Math.min(100.0, blended);
    }
    cvssUsed = true;
  } else {
    // Missing or invalid CVSS falls back to base weight
    score = baseWeight;
  }

  return {
    score: Math.round(score * 100) / 100,
    severity,
    cvssUsed,
    floorApplied,
    validCvss,
  };
}

/**
 * Deduplicates findings based on stable finding identity:
 * identity = scanner_name + '::' + finding_id/vuln_id + '::' + affected_component
 * 
 * When duplicates exist, retains the entry with the highest individual risk score.
 */
function deduplicateFindings(findings = []) {
  const map = new Map();

  for (const f of findings) {
    const scanner = (f.scanner_name || f.scannerName || 'unknown').trim().toLowerCase();
    const id = (f.vuln_id || f.vulnId || f.finding_id || f.findingId || f.title || 'generic').trim();
    const component = (f.affected_component || f.affectedComponent || 'root').trim();
    const key = `${scanner}::${id}::${component}`;

    const evaluated = calculateFindingScore(f);
    const candidate = { ...f, _evaluated: evaluated, _stableKey: key };

    if (!map.has(key)) {
      map.set(key, candidate);
    } else {
      const existing = map.get(key);
      if (evaluated.score > existing._evaluated.score) {
        map.set(key, candidate);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Calculates overall scan risk score and detailed rationale.
 * 
 * Deterministic tie-breaking for dominant finding:
 * 1. Highest finding risk score.
 * 2. Highest severity rank when scores tie.
 * 3. Stable key alphanumeric ordering as final tie-breaker.
 */
function calculateRisk(rawFindings = []) {
  const deduplicated = deduplicateFindings(rawFindings);

  const counts = {
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    info_count: 0,
  };

  if (deduplicated.length === 0) {
    return {
      overallRiskScore: 0.00,
      counts,
      dominantFinding: null,
      compoundingBonus: 0.00,
      assessmentRationale: 'Clean scan: No security findings identified. Risk score is 0.00.',
      deduplicatedCount: 0,
      rawCount: rawFindings.length,
    };
  }

  // Count severities
  for (const f of deduplicated) {
    const sev = f._evaluated.severity;
    if (sev === 'CRITICAL') counts.critical_count++;
    else if (sev === 'HIGH') counts.high_count++;
    else if (sev === 'MEDIUM') counts.medium_count++;
    else if (sev === 'LOW') counts.low_count++;
    else counts.info_count++;
  }

  // Sort to pick exactly one dominant finding deterministically
  const sorted = [...deduplicated].sort((a, b) => {
    // 1. Finding score desc
    if (b._evaluated.score !== a._evaluated.score) {
      return b._evaluated.score - a._evaluated.score;
    }
    // 2. Severity rank desc
    const rankDiff = (SEVERITY_RANK[b._evaluated.severity] || 0) - (SEVERITY_RANK[a._evaluated.severity] || 0);
    if (rankDiff !== 0) return rankDiff;
    // 3. Stable key asc
    return a._stableKey.localeCompare(b._stableKey);
  });

  const dominant = sorted[0];
  const rMax = dominant._evaluated.score;

  // Remaining findings exclude exactly one dominant finding
  const remaining = sorted.slice(1);
  let rawBonus = 0.0;
  for (const item of remaining) {
    rawBonus += (COMPOUND_BONUS_WEIGHTS[item._evaluated.severity] || 0.0);
  }

  // Bounded bonus: cannot exceed 100 - rMax
  const compoundingBonus = Math.round(Math.min(100.00 - rMax, rawBonus) * 100) / 100;
  const overallRiskScore = Math.round(Math.min(100.00, rMax + compoundingBonus) * 100) / 100;

  // Build explainable assessment rationale
  const rationaleParts = [
    `Overall Risk Score: ${overallRiskScore.toFixed(2)}/100.00 (Dominant Finding: ${rMax.toFixed(2)}, Compounding Density Bonus: +${compoundingBonus.toFixed(2)}).`,
    `Finding distribution: ${counts.critical_count} CRITICAL, ${counts.high_count} HIGH, ${counts.medium_count} MEDIUM, ${counts.low_count} LOW, ${counts.info_count} INFO across ${deduplicated.length} unique finding(s).`,
  ];

  if (dominant._evaluated.floorApplied) {
    rationaleParts.push(`Floor protection applied on dominant finding (${dominant._evaluated.severity}) to preserve severity threshold against lower CVSS.`);
  }

  if (rawFindings.length > deduplicated.length) {
    rationaleParts.push(`${rawFindings.length - deduplicated.length} duplicate finding instance(s) safely merged.`);
  }

  return {
    overallRiskScore,
    counts,
    dominantFinding: {
      key: dominant._stableKey,
      title: dominant.title,
      severity: dominant._evaluated.severity,
      score: rMax,
    },
    compoundingBonus,
    assessmentRationale: rationaleParts.join(' '),
    deduplicatedFindings: deduplicated,
    deduplicatedCount: deduplicated.length,
    rawCount: rawFindings.length,
  };
}

module.exports = {
  calculateRisk,
  calculateFindingScore,
  deduplicateFindings,
  SEVERITY_WEIGHTS,
};
