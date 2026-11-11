const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * API Key Authentication Middleware
 *
 * Validates incoming `x-api-key` header against the server's configured `API_KEY`.
 * Employs timing-safe equality comparison to prevent side-channel timing attacks.
 * Fails securely if API_KEY is empty or unconfigured.
 * Never logs the API key or authorization headers.
 */
function apiKeyAuth(req, res, next) {
  const configuredKey = config.apiKey;

  // Fail securely if no API key is configured on the server
  if (!configuredKey || typeof configuredKey !== 'string' || configuredKey.trim().length === 0) {
    return res.status(500).json({
      status: 'error',
      message: 'Server authentication configuration is unavailable.',
      timestamp: new Date().toISOString(),
    });
  }

  const clientKey = req.headers['x-api-key'];

  if (!clientKey || typeof clientKey !== 'string') {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Missing x-api-key header.',
      timestamp: new Date().toISOString(),
    });
  }

  const clientBuf = Buffer.from(clientKey);
  const serverBuf = Buffer.from(configuredKey);

  // Buffer lengths must match for timingSafeEqual
  if (clientBuf.length !== serverBuf.length || !crypto.timingSafeEqual(clientBuf, serverBuf)) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid API key provided.',
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

module.exports = { apiKeyAuth };
