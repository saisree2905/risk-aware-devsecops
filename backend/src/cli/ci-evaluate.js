#!/usr/bin/env node

/**
 * CI Security Evaluation Client Script
 *
 * Invoked by GitHub Actions to read local scan JSON reports, package them into
 * the POST /api/scans/ingest payload format, transmit securely with x-api-key,
 * and enforce pipeline decisions (PASS, WARN, BLOCK) with fail-closed semantics.
 */

const fs = require('fs');
const path = require('path');

// Constants
const REQUIRED_SCANNERS = ['semgrep', 'trivy_fs', 'trivy_image'];

/**
 * Parses command-line arguments into a structured map
 */
function parseArgs(argv) {
  const options = {
    apiUrl: process.env.API_URL || '',
    apiKey: process.env.API_KEY || '',
    commitHash: process.env.GITHUB_SHA || '',
    branch: process.env.GITHUB_REF_NAME || '',
    triggerEvent: process.env.GITHUB_EVENT_NAME || 'push',
    initiatedBy: process.env.GITHUB_ACTOR ? `github-actions/${process.env.GITHUB_ACTOR}` : 'github-actions',
    semgrepReport: '',
    trivyFsReport: '',
    trivyImageReport: '',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--api-url' && argv[i + 1]) options.apiUrl = argv[++i];
    else if (arg === '--api-key' && argv[i + 1]) options.apiKey = argv[++i];
    else if (arg === '--commit' && argv[i + 1]) options.commitHash = argv[++i];
    else if (arg === '--branch' && argv[i + 1]) options.branch = argv[++i];
    else if (arg === '--trigger' && argv[i + 1]) options.triggerEvent = argv[++i];
    else if (arg === '--semgrep' && argv[i + 1]) options.semgrepReport = argv[++i];
    else if (arg === '--trivy-fs' && argv[i + 1]) options.trivyFsReport = argv[++i];
    else if (arg === '--trivy-image' && argv[i + 1]) options.trivyImageReport = argv[++i];
  }

  return options;
}

/**
 * Validates report file existence and parseable JSON content
 */
function loadReport(filePath, scannerName) {
  if (!filePath) {
    throw new Error(`Missing argument or path for ${scannerName} report file.`);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Report file for ${scannerName} not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  if (!raw || raw.trim().length === 0) {
    throw new Error(`Report file for ${scannerName} is empty.`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Report file for ${scannerName} contains invalid JSON: ${err.message}`);
  }
}

/**
 * Evaluates the API response decision
 * Returns 0 for PASS or WARN, exits process with 1 for BLOCK or errors
 */
function evaluateDecision(resultData) {
  const { scanId, scanStatus, pipelineDecision, riskAssessment, errors } = resultData;

  console.log('\n========================================');
  console.log('   CI/CD SECURITY EVALUATION REPORT     ');
  console.log('========================================');
  console.log(`Scan ID:        ${scanId || 'N/A'}`);
  console.log(`Scan Status:    ${scanStatus || 'N/A'}`);

  if (riskAssessment) {
    console.log(`Risk Score:     ${riskAssessment.overallRiskScore} / 100.00`);
    console.log(`Findings Total: ${resultData.normalizedFindingCount || 0}`);
  }

  const decision = pipelineDecision ? pipelineDecision.decision : 'UNKNOWN';
  const isBlocking = pipelineDecision ? Boolean(pipelineDecision.isBlocking) : true;
  const rationale = pipelineDecision ? pipelineDecision.decisionRationale : 'No rationale provided';

  console.log(`Decision:       ${decision}`);
  console.log(`Enforcement:    ${isBlocking ? 'BLOCKING (Fail Pipeline)' : 'NON-BLOCKING'}`);
  console.log(`Rationale:      ${rationale}`);

  if (errors && errors.length > 0) {
    console.log('\nExecution Errors:');
    for (const e of errors) {
      console.log(` - [${e.scanner || 'general'}]: ${e.error || e.message || JSON.stringify(e)}`);
    }
  }
  console.log('========================================\n');

  if (scanStatus === 'FAILED' || decision === 'BLOCK' || isBlocking) {
    console.error(`[CI FAILED]: Security gate triggered BLOCK decision. ${rationale}`);
    return { exitCode: 1, decision };
  }

  if (decision === 'WARN') {
    console.warn(`[CI WARNING]: Security findings crossed WARN threshold. Review findings before release.`);
    return { exitCode: 0, decision };
  }

  if (decision === 'PASS') {
    console.log(`[CI PASSED]: Security gate passed successfully.`);
    return { exitCode: 0, decision };
  }

  console.error(`[CI FAILED]: Unrecognized decision status "${decision}". Failing closed.`);
  return { exitCode: 1, decision };
}

/**
 * Main execution routine
 */
async function run(argv = process.argv) {
  const options = parseArgs(argv);

  // 1. Validate required environment configuration
  if (!options.apiUrl) {
    console.error('[CI Security Error]: API_URL is required (via --api-url or API_URL environment variable).');
    return 1;
  }
  if (!options.apiKey) {
    console.error('[CI Security Error]: API_KEY is required (via --api-key or API_KEY environment variable).');
    return 1;
  }
  if (!options.commitHash) {
    console.error('[CI Security Error]: Commit hash is required (via --commit or GITHUB_SHA).');
    return 1;
  }
  if (!options.branch) {
    console.error('[CI Security Error]: Branch name is required (via --branch or GITHUB_REF_NAME).');
    return 1;
  }

  // 2. Load and validate all three required scanner reports
  const scannerPayloads = {};
  try {
    scannerPayloads.semgrep = loadReport(options.semgrepReport, 'semgrep');
    scannerPayloads.trivy_fs = loadReport(options.trivyFsReport, 'trivy_fs');
    scannerPayloads.trivy_image = loadReport(options.trivyImageReport, 'trivy_image');
  } catch (err) {
    console.error(`[CI Security Error]: ${err.message}`);
    return 1;
  }

  // 3. Construct API payload
  const payload = {
    commitHash: options.commitHash,
    branch: options.branch,
    triggerEvent: options.triggerEvent,
    initiatedBy: options.initiatedBy,
    scannerPayloads,
  };

  const endpoint = options.apiUrl.replace(/\/+$/, '') + '/api/scans/ingest';
  console.log(`Submitting scan reports to ingestion endpoint: ${endpoint}`);
  console.log(`Commit: ${options.commitHash} | Branch: ${options.branch} | Trigger: ${options.triggerEvent}`);

  // 4. Send HTTP POST request
  let response;
  try {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      throw new Error('Native fetch is unavailable in current Node.js runtime.');
    }

    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    console.error(`[CI Security Error]: Failed to connect to scan ingestion API: ${netErr.message}`);
    console.error(`Failing closed: Security evaluation could not be verified.`);
    return 1;
  }

  // 5. Handle HTTP status codes
  let responseBody;
  try {
    responseBody = await response.json();
  } catch (parseErr) {
    console.error(`[CI Security Error]: Received unparseable response from API (HTTP ${response.status})`);
    return 1;
  }

  if (response.status === 201) {
    const evaluation = evaluateDecision(responseBody.data || {});
    return evaluation.exitCode;
  }

  if (response.status === 422) {
    console.error(`[CI Security Gate]: Scan processing completed with scanner or evaluation failure (HTTP 422).`);
    const evaluation = evaluateDecision(responseBody.data || {});
    return evaluation.exitCode !== 0 ? evaluation.exitCode : 1;
  }

  // All other HTTP statuses (400, 401, 413, 500, etc.) fail closed
  console.error(`[CI Security Error]: Ingestion API rejected request with HTTP ${response.status}`);
  if (responseBody && responseBody.message) {
    console.error(`Message: ${responseBody.message}`);
  }
  return 1;
}

if (require.main === module) {
  run().then((code) => {
    process.exit(code);
  }).catch((err) => {
    console.error(`[CI Security Fatal]: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  loadReport,
  evaluateDecision,
  run,
};
