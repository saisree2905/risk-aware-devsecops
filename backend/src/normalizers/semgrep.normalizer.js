/**
 * Semgrep JSON Output Normalizer
 * 
 * Conservative, documented mapping of Semgrep SAST findings into normalized schema.
 * 
 * Severity Mapping Rationale:
 * - Semgrep uses 3 primary severity levels: INFO, WARNING, ERROR.
 * - ERROR does NOT automatically mean CRITICAL. In static analysis, many ERROR-level rules
 *   are general bugs or standard code smells.
 * - Mapping Rules:
 *   - 'INFO' -> 'INFO'
 *   - 'WARNING' -> 'MEDIUM'
 *   - 'ERROR':
 *     - If rule metadata explicitly indicates Critical impact (e.g. CWE-89 SQLi, CWE-78 Command Injection,
 *       CWE-94 Code Injection, or confidence HIGH/CRITICAL in metadata), maps to 'HIGH' or 'CRITICAL'.
 *     - Otherwise conservative default is 'HIGH'.
 */

function normalizeSemgrepSeverity(rawSeverity, metadata = {}) {
  const sev = (rawSeverity || 'INFO').toUpperCase();

  if (sev === 'INFO') return 'INFO';
  if (sev === 'WARNING') return 'MEDIUM';

  if (sev === 'ERROR') {
    // Check metadata for critical classifications
    const cwe = String(metadata.cwe || '').toUpperCase();
    const impact = String(metadata.impact || '').toUpperCase();
    const confidence = String(metadata.confidence || '').toUpperCase();

    // Critical impact markers: require explicit CRITICAL impact or high-confidence remote code execution / injection CWEs
    const criticalCwes = ['CWE-89', 'CWE-78', 'CWE-94', 'CWE-502'];
    const isCriticalCwe = criticalCwes.some((c) => cwe.includes(c));

    if (impact === 'CRITICAL' || (isCriticalCwe && (confidence === 'HIGH' || impact === 'HIGH'))) {
      return 'CRITICAL';
    }

    // Default conservative mapping for ERROR (including general high-impact findings)
    return 'HIGH';
  }

  return 'LOW';
}

/**
 * Normalizes raw Semgrep JSON output string or object into standard findings array.
 */
function normalizeSemgrepOutput(rawOutput) {
  if (!rawOutput) return [];

  let data;
  if (typeof rawOutput === 'string') {
    try {
      data = JSON.parse(rawOutput);
    } catch (parseErr) {
      throw new Error(`Failed to parse Semgrep JSON output: ${parseErr.message}`);
    }
  } else {
    data = rawOutput;
  }

  const results = data.results || [];
  const normalized = [];

  for (const item of results) {
    const ruleId = item.check_id || 'unknown-rule';
    const filePath = item.path || 'unknown-file';
    const startLine = item.start?.line || 0;
    const endLine = item.end?.line || startLine;
    const location = `${filePath}:${startLine}${endLine !== startLine ? `-${endLine}` : ''}`;

    const metadata = item.extra?.metadata || {};
    const severity = normalizeSemgrepSeverity(item.extra?.severity, metadata);

    // Extract CVE or CWE identifiers
    let vulnId = null;
    if (metadata.cve) {
      vulnId = Array.isArray(metadata.cve) ? metadata.cve[0] : String(metadata.cve);
    } else if (metadata.cwe) {
      vulnId = Array.isArray(metadata.cwe) ? metadata.cwe[0] : String(metadata.cwe);
    } else {
      vulnId = ruleId;
    }

    // Extract CVSS if provided in metadata (e.g. cvss: 7.5 or cvss: "7.5")
    let cvssScore = null;
    if (metadata.cvss !== undefined && metadata.cvss !== null) {
      const parsed = parseFloat(metadata.cvss);
      if (!Number.isNaN(parsed) && parsed >= 0.0 && parsed <= 10.0) {
        cvssScore = Math.round(parsed * 100) / 100;
      }
    }

    const message = item.extra?.message?.trim() || 'No description provided by rule.';
    const lines = message.split('\n');
    const title = lines[0].slice(0, 200);

    normalized.push({
      scanner_name: 'semgrep',
      finding_id: ruleId,
      vuln_id: vulnId,
      title,
      description: message,
      severity,
      cvss_score: cvssScore,
      affected_component: location,
      affected_version: null,
      fixed_version: metadata.fix || null,
      remediation: metadata.remediation || (metadata.references ? `References: ${metadata.references.join(', ')}` : null),
      raw_payload: item,
    });
  }

  return normalized;
}

module.exports = {
  normalizeSemgrepOutput,
  normalizeSemgrepSeverity,
};
