const express = require('express');
const { getPoliciesList } = require('../controllers/policy.controller');
const { publicRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Retrieve security policies and gating rules
router.get('/', publicRateLimiter, getPoliciesList);

module.exports = router;
