const db = require('../database');

/**
 * Liveness Check: GET /api/health/live
 * Verifies that the Node.js event loop and process are alive and serving requests.
 * Does not query the database, ensuring transient DB issues do not cause container restart loops.
 */
function getLiveness(req, res) {
  return res.status(200).json({
    status: 'ok',
    service: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
  });
}

/**
 * Readiness & Diagnostics Check: GET /api/health/ready and GET /api/health
 * Verifies connectivity to Supabase Session Pooler.
 * Returns 200 when DB is reachable, 503 when unreachable.
 */
async function getHealth(req, res) {
  const dbStatus = await db.checkConnection();

  if (dbStatus && dbStatus.connected) {
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime() * 100) / 100,
    });
  }

  return res.status(503).json({
    status: 'error',
    database: 'disconnected',
    message: 'Database service is currently unreachable',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
  getLiveness,
};
