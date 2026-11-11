const express = require('express');
const {
  ingestScan,
  getScanById,
  getScansList,
  getFullScanDetails,
  getScanFindings,
} = require('../controllers/scan.controller');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { publicRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// -----------------------------------------------------------------------------
// 1. Ingestion Endpoint (Strictly Protected by API Key Authentication)
// -----------------------------------------------------------------------------
router.post('/ingest', apiKeyAuth, ingestScan);

// -----------------------------------------------------------------------------
// 2. Public Read-Only Dashboard Endpoints (Protected by Rate Limiter & Allowlisting)
// -----------------------------------------------------------------------------
// Retrieve paginated and filterable list of scans
router.get('/', publicRateLimiter, getScansList);

// Retrieve basic scan summary by ID
router.get('/:id', publicRateLimiter, getScanById);

// Retrieve complete scan audit details (metadata, assessment, decision, policy)
router.get('/:id/full', publicRateLimiter, getFullScanDetails);

// Retrieve paginated and filterable security findings for a scan (raw_payload omitted)
router.get('/:id/findings', publicRateLimiter, getScanFindings);

module.exports = router;
