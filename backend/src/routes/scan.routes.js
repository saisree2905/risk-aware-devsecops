const express = require('express');
const { ingestScan, getScanById } = require('../controllers/scan.controller');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

const router = express.Router();

// Apply API key authentication to all scan endpoints
router.use(apiKeyAuth);

// Ingest scan reports from CI/CD pipeline
router.post('/ingest', ingestScan);

// Retrieve scan decision & assessment details
router.get('/:id', getScanById);

module.exports = router;
