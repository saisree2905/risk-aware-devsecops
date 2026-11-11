const express = require('express');
const { getHealth, getLiveness } = require('../controllers/health.controller');

const router = express.Router();

// Liveness probe (no DB query, process vitality only)
router.get('/live', getLiveness);

// Readiness probe (DB connectivity check)
router.get('/ready', getHealth);

// Full health check (backwards-compatible alias to readiness)
router.get('/', getHealth);

module.exports = router;
