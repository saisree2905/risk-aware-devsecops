const db = require('../database');

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
};
