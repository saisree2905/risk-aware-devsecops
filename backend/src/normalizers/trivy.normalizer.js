/**
 * Trivy JSON Output Normalizer
 * 
 * Parses and normalizes Trivy vulnerability scan outputs (filesystem, SCA, and container images).
 * 
 * CVSS Handling:
 * - Checks NVD V3 score first, then Vendor (e.g. RedHat/GHSA) V3 score.
 * - Conflicting/Invalid scores (<0 or >10 or NaN) are safely ignored (set to null),
 *   triggering the risk engine's severity fallback rather than guessing or fabricating numbers.
 */

function extractTrivyCvss(vuln) {
  const cvssObj = vuln.CVSS;
  if (!cvssObj || typeof cvssObj !== 'object') return null;

  // Prefer NVD V3Score, fallback to redhat/ghsa V3Score
  const candidates = [
    cvssObj.nvd?.V3Score,
    cvssObj.redhat?.V3Score,
    cvssObj.ghsa?.V3Score,
  ];

  for (const val of candidates) {
    if (val !== undefined && val !== null && val !== '') {
      const parsed = parseFloat(val);
      if (!Number.isNaN(parsed) && parsed >= 0.0 && parsed <= 10.0) {
        return Math.round(parsed * 100) / 100;
      }
    }
  }

  return null;
}

function normalizeTrivySeverity(rawSeverity) {
  const sev = (rawSeverity || 'UNKNOWN').toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
    return sev;
  }
  return 'INFO';
}

/**
 * Normalizes raw Trivy JSON output into standard findings array.
 */
function normalizeTrivyOutput(rawOutput) {
  if (!rawOutput) return [];

  let data;
  if (typeof rawOutput === 'string') {
    try {
      data = JSON.parse(rawOutput);
    } catch (parseErr) {
      throw new Error(`Failed to parse Trivy JSON output: ${parseErr.message}`);
    }
  } else {
    data = rawOutput;
  }

  const results = data.Results || [];
  const normalized = [];

  for (const section of results) {
    const target = section.Target || 'package.json';
    const vulnerabilities = section.Vulnerabilities || [];

    for (const vuln of vulnerabilities) {
      const vulnId = vuln.VulnerabilityID || 'UNKNOWN_VULN';
      const pkgName = vuln.PkgName || 'unknown-package';
      const installedVersion = vuln.InstalledVersion || null;
      const fixedVersion = vuln.FixedVersion || null;
      const severity = normalizeTrivySeverity(vuln.Severity);
      const cvssScore = extractTrivyCvss(vuln);

      const component = installedVersion
        ? `${pkgName}@${installedVersion} (${target})`
        : `${pkgName} (${target})`;

      const title = (vuln.Title || `${vulnId} in ${pkgName}`).slice(0, 200);
      const description = vuln.Description || vuln.Title || 'No description provided by vulnerability advisory.';

      let remediation = null;
      if (fixedVersion) {
        remediation = `Upgrade ${pkgName} to version ${fixedVersion} or later.`;
      } else if (vuln.PrimaryURL) {
        remediation = `Review advisory for mitigation: ${vuln.PrimaryURL}`;
      }

      normalized.push({
        scanner_name: 'trivy',
        finding_id: vulnId,
        vuln_id: vulnId,
        title,
        description,
        severity,
        cvss_score: cvssScore,
        affected_component: component,
        affected_version: installedVersion,
        fixed_version: fixedVersion,
        remediation,
        raw_payload: vuln,
      });
    }
  }

  return normalized;
}

module.exports = {
  normalizeTrivyOutput,
  normalizeTrivySeverity,
  extractTrivyCvss,
};
