/**
 * Scan Ingestion Payload Validator
 *
 * Enforces strict typing, required fields, and structural validation
 * on incoming scan payloads from CI pipelines.
 */

const ALLOWED_TRIGGERS = ['push', 'pull_request', 'manual', 'schedule', 'workflow_dispatch', 'test-suite'];
const REQUIRED_SCANNERS = ['semgrep', 'trivy_fs', 'trivy_image'];
const ALLOWED_SCANNER_KEYS = ['semgrep', 'trivy_fs', 'trivy_image'];

function validateIngestPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Request body must be a JSON object.' };
  }

  const { commitHash, branch, triggerEvent, scannerPayloads } = body;

  // 1. Commit hash validation (git SHA-1 or SHA-256)
  if (!commitHash || typeof commitHash !== 'string' || !/^[0-9a-fA-F]{7,64}$/.test(commitHash.trim())) {
    return {
      valid: false,
      message: 'Invalid or missing "commitHash". Must be a valid git commit hash (7-64 hex chars).',
    };
  }

  // 2. Branch validation
  if (!branch || typeof branch !== 'string' || branch.trim().length === 0 || branch.length > 100) {
    return {
      valid: false,
      message: 'Invalid or missing "branch". Must be a non-empty string under 100 characters.',
    };
  }

  // 3. Trigger event validation
  const trigger = (triggerEvent || 'push').toLowerCase().trim();
  if (!ALLOWED_TRIGGERS.includes(trigger)) {
    return {
      valid: false,
      message: `Invalid "triggerEvent". Allowed values: ${ALLOWED_TRIGGERS.join(', ')}.`,
    };
  }

  // 4. Scanner payloads validation
  if (!scannerPayloads || typeof scannerPayloads !== 'object' || Array.isArray(scannerPayloads)) {
    return {
      valid: false,
      message: 'Invalid or missing "scannerPayloads". Must be an object containing scanner output data.',
    };
  }

  const scannerKeys = Object.keys(scannerPayloads);

  // Enforce complete required scanner coverage
  const missingScanners = REQUIRED_SCANNERS.filter((scanner) => !scannerKeys.includes(scanner));
  if (missingScanners.length > 0) {
    return {
      valid: false,
      message: `Missing required scanner reports: ${missingScanners.join(', ')}.`,
    };
  }

  for (const key of scannerKeys) {
    if (!ALLOWED_SCANNER_KEYS.includes(key)) {
      return {
        valid: false,
        message: `Unsupported scanner payload key "${key}". Allowed keys: ${ALLOWED_SCANNER_KEYS.join(', ')}.`,
      };
    }

    const payload = scannerPayloads[key];
    if (payload === null || payload === undefined) {
      return {
        valid: false,
        message: `Payload for scanner "${key}" cannot be null or undefined.`,
      };
    }

    // Must be either a non-empty string (JSON) or an object
    if (typeof payload === 'string') {
      if (payload.trim().length === 0) {
        return { valid: false, message: `Scanner payload for "${key}" cannot be an empty string.` };
      }
      try {
        JSON.parse(payload);
      } catch (err) {
        return { valid: false, message: `Scanner payload for "${key}" is not valid JSON string: ${err.message}` };
      }
    } else if (typeof payload !== 'object') {
      return {
        valid: false,
        message: `Scanner payload for "${key}" must be a JSON object or serialized JSON string.`,
      };
    }
  }

  return {
    valid: true,
    data: {
      commitHash: commitHash.trim(),
      branch: branch.trim(),
      triggerEvent: trigger,
      initiatedBy: typeof body.initiatedBy === 'string' ? body.initiatedBy.slice(0, 100) : 'ci-pipeline',
      scannerPayloads,
    },
  };
}

module.exports = { validateIngestPayload, REQUIRED_SCANNERS, ALLOWED_SCANNER_KEYS };
