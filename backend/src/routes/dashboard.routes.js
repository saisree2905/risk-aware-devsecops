const express = require('express');
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { publicRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Retrieve aggregated metrics, latest scan summary and policy status
router.get('/stats', publicRateLimiter, getDashboardStats);

module.exports = router;
