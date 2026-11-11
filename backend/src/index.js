const app = require('./app');
const { config, validateConfig, maskConnectionString } = require('./config/env');
const db = require('./database');

let isShuttingDown = false;
let serverInstance = null;

/**
 * Gracefully shuts down the server, draining active connections and closing DB pool.
 * Idempotent: repeated signals do not trigger multiple concurrent shutdowns.
 */
async function gracefulShutdown(signal, server = serverInstance) {
  if (isShuttingDown) {
    console.log(`[Server] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // Bounded shutdown timer: force exit if cleanup hangs
  const forcedExitTimer = setTimeout(() => {
    console.error(`[Server Error] Shutdown timed out after ${config.shutdownTimeoutMs}ms. Forcing process exit.`);
    process.exit(1);
  }, config.shutdownTimeoutMs);

  // Unref timer so it does not keep the Node event loop alive if cleanup finishes sooner
  if (forcedExitTimer.unref) forcedExitTimer.unref();

  try {
    // 1. Stop accepting new HTTP connections and drain in-flight requests
    if (server && server.close) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          console.log('[Server] HTTP server stopped accepting connections.');
          resolve();
        });
      });
    }

    // 2. Cleanly close database connection pool
    console.log('[Server] Closing PostgreSQL connection pool...');
    await db.closePool();
    console.log('[Server] PostgreSQL connection pool closed cleanly.');

    clearTimeout(forcedExitTimer);
    console.log('[Server] Graceful shutdown completed.');

    // Only call process.exit if running as main process
    if (require.main === module) {
      process.exit(0);
    }
  } catch (err) {
    console.error('[Server Error] Error occurred during graceful shutdown:', err.message);
    clearTimeout(forcedExitTimer);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Boots the HTTP server and registers process-level lifecycle handlers.
 */
async function startServer() {
  try {
    validateConfig();
    console.log('[Server] Environment configuration validated.');
    console.log(`[Server] Target database URL: ${maskConnectionString(config.databaseUrl)}`);

    const dbStatus = await db.checkConnection();
    if (dbStatus.connected) {
      console.log('[Server] Database connection verified (Supabase Session Pooler).');
    } else {
      console.warn('[Server Warning] Initial database connection check failed:', dbStatus.error);
    }

    return new Promise((resolve, reject) => {
      // Explicitly bind to configured host (default: '0.0.0.0') for cloud container compatibility
      const server = app.listen(config.port, config.host, () => {
        console.log(`[Server] Risk-Aware Backend running on ${config.host}:${config.port} (${config.env})`);
        serverInstance = server;

        // Register lifecycle signals if running as main process
        if (require.main === module) {
          process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
          process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
        }

        resolve(server);
      });

      // Handle server startup errors (e.g. EADDRINUSE)
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[Server Boot Error] Port ${config.port} on ${config.host} is already in use.`);
        } else {
          console.error('[Server Boot Error] HTTP server failed to start:', err.message);
        }
        if (require.main === module) {
          process.exit(1);
        }
        reject(err);
      });
    });
  } catch (err) {
    console.error('[Server Boot Error]:', err.message);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  gracefulShutdown,
  getIsShuttingDown: () => isShuttingDown,
  resetShutdownState: () => { isShuttingDown = false; serverInstance = null; },
};
