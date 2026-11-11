const app = require('./app');
const { config, validateConfig, maskConnectionString } = require('./config/env');
const { checkConnection } = require('./database');

async function startServer() {
  try {
    validateConfig();
    console.log('[Server] Environment configuration validated.');
    console.log(`[Server] Target database URL: ${maskConnectionString(config.databaseUrl)}`);

    const dbStatus = await checkConnection();
    if (dbStatus.connected) {
      console.log('[Server] Database connection verified (Supabase Session Pooler).');
    } else {
      console.warn('[Server Warning] Initial database connection check failed:', dbStatus.error);
    }

    const server = app.listen(config.port, () => {
      console.log(`[Server] Risk-Aware Backend running on port ${config.port} (${config.env})`);
    });

    return server;
  } catch (err) {
    console.error('[Server Boot Error]:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
