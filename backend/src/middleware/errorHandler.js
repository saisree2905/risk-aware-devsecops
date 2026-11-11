const { sanitizeDbError } = require('../database');

function errorHandler(err, req, res, next) {
  const sanitized = sanitizeDbError(err);
  const statusCode = err.statusCode || err.status || 500;

  // Mask internal stack traces in production / development to avoid credential leakage
  console.error('[API Error]:', sanitized.message);

  res.status(statusCode).json({
    status: 'error',
    message: statusCode === 500 ? 'Internal server error' : sanitized.message,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { errorHandler };
