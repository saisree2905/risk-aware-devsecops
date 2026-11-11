const fs = require('fs');
const { Pool } = require('pg');
const { config, maskConnectionString } = require('../config/env');

let pool = null;

function sanitizeDbError(err) {
  if (!err) return new Error('Unknown database error');
  // Strip out any accidental connection string or host/password leakage
  const safeMessage = (err.message || 'Database error occurred')
    .replace(/postgresql:\/\/[^\s]+/gi, 'postgresql://***:***@masked-host/db')
    .replace(/:([^\s:@/]+)@/g, ':***@');
  const safeError = new Error(safeMessage);
  safeError.code = err.code;
  return safeError;
}

function getSslConfig() {
  if (process.env.DB_SSL === 'false') {
    return false;
  }
  // If user provided a CA certificate path
  if (process.env.DB_CA_CERT_PATH && fs.existsSync(process.env.DB_CA_CERT_PATH)) {
    return {
      ca: fs.readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
      rejectUnauthorized: true,
    };
  }
  // Standard Supabase Session Pooler configuration:
  // Supabase pooler terminates SSL with internal certificates; rejectUnauthorized: false is the documented setting
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  return { rejectUnauthorized };
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.dbPool.max,
      min: config.dbPool.min,
      idleTimeoutMillis: config.dbPool.idleTimeoutMillis,
      connectionTimeoutMillis: config.dbPool.connectionTimeoutMillis,
      ssl: getSslConfig(),
    });

    pool.on('error', (err) => {
      const sanitized = sanitizeDbError(err);
      console.error('[Database Pool Error]:', sanitized.message);
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  try {
    return await p.query(text, params);
  } catch (err) {
    throw sanitizeDbError(err);
  }
}

/**
 * Execute a callback within an explicit transaction.
 * Rolls back automatically if callback throws.
 */
async function withTransaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Rollback Error]:', sanitizeDbError(rollbackErr).message);
    }
    throw sanitizeDbError(err);
  } finally {
    client.release();
  }
}

async function checkConnection() {
  try {
    const p = getPool();
    const res = await p.query('SELECT 1 AS alive');
    return { connected: true, alive: res.rows[0]?.alive === 1 };
  } catch (err) {
    return { connected: false, error: sanitizeDbError(err).message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  checkConnection,
  closePool,
  sanitizeDbError,
};
