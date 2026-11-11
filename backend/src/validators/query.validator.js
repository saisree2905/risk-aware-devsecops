/**
 * Query Parameter & Identifier Validator
 *
 * Enforces pagination bounds, allowlisted filter values, and strict UUID validation
 * to protect backend queries from unbounded memory consumption and malformed inputs.
 */

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ALLOWED_DECISIONS = ['PASS', 'WARN', 'BLOCK'];
const ALLOWED_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const ALLOWED_SCANNERS = ['semgrep', 'trivy', 'trivy_fs', 'trivy_image'];
const ALLOWED_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Validates and bounds pagination parameters
 * @param {object} query - Request query object
 * @param {object} defaults - Default and max limit overrides
 */
function parsePagination(query, defaults = { defaultLimit: 20, maxLimit: 100 }) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaults.defaultLimit;
  } else if (limit > defaults.maxLimit) {
    limit = defaults.maxLimit;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Validates and sanitizes scan list filter parameters
 */
function validateScanFilters(query) {
  const errors = [];
  const filters = {};

  if (query.decision) {
    const dec = String(query.decision).trim().toUpperCase();
    if (!ALLOWED_DECISIONS.includes(dec)) {
      errors.push(`Invalid decision filter. Allowed values: ${ALLOWED_DECISIONS.join(', ')}`);
    } else {
      filters.decision = dec;
    }
  }

  if (query.status) {
    const stat = String(query.status).trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(stat)) {
      errors.push(`Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
    } else {
      filters.status = stat;
    }
  }

  if (query.branch) {
    const branch = String(query.branch).trim();
    if (branch.length > 100) {
      errors.push('Branch filter must not exceed 100 characters');
    } else if (branch.length > 0) {
      // Basic sanitization: strip dangerous control characters
      filters.branch = branch.replace(/[^\w\d\-_\.\/]/g, '');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    filters,
  };
}

/**
 * Validates and sanitizes findings list filter parameters
 */
function validateFindingFilters(query) {
  const errors = [];
  const filters = {};

  if (query.severity) {
    const sev = String(query.severity).trim().toUpperCase();
    if (!ALLOWED_SEVERITIES.includes(sev)) {
      errors.push(`Invalid severity filter. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`);
    } else {
      filters.severity = sev;
    }
  }

  if (query.scanner) {
    const sc = String(query.scanner).trim().toLowerCase();
    if (!ALLOWED_SCANNERS.includes(sc)) {
      errors.push(`Invalid scanner filter. Allowed values: ${ALLOWED_SCANNERS.join(', ')}`);
    } else {
      filters.scanner = sc;
    }
  }

  if (query.search) {
    const rawSearch = String(query.search).trim();
    if (rawSearch.length > 100) {
      errors.push('Search query must not exceed 100 characters');
    } else if (rawSearch.length > 0) {
      // Strip wildcard characters for clean ILIKE matching
      filters.search = rawSearch.replace(/[%_]/g, '');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    filters,
  };
}

module.exports = {
  isValidUuid,
  parsePagination,
  validateScanFilters,
  validateFindingFilters,
  ALLOWED_DECISIONS,
  ALLOWED_SEVERITIES,
  ALLOWED_SCANNERS,
  ALLOWED_STATUSES,
};
