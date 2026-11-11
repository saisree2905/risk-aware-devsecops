const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function maskConnectionString(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const maskedUser = parsed.username ? '***' : '';
    const maskedPass = parsed.password ? '***' : '';
    const auth = (maskedUser || maskedPass) ? `${maskedUser}:${maskedPass}@` : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return 'postgresql://***:***@masked-host/db';
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL,
  caCertPath: process.env.DB_CA_CERT_PATH || '',
  sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10),
  dbPool: {
    max: parseInt(process.env.DB_POOL_MAX || '2', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  apiKey: process.env.API_KEY || (process.env.NODE_ENV === 'production' ? '' : 'devsecops_dev_key'),
  maskConnectionString,
};

function validateConfig() {
  if (!config.databaseUrl) {
    throw new Error('Missing required configuration: DATABASE_URL is not set.');
  }

  // In production, an explicit API_KEY is strictly required with zero fallback
  if (config.env === 'production' && (!config.apiKey || config.apiKey.trim().length === 0)) {
    throw new Error('Missing required configuration: API_KEY must be set in production mode.');
  }

  // In production, strict TLS verification is strictly enforced
  // If DB_SSL_REJECT_UNAUTHORIZED=false is explicitly configured, fail closed
  if (config.env === 'production' && !config.sslRejectUnauthorized) {
    throw new Error('Production security violation: DB_SSL_REJECT_UNAUTHORIZED cannot be set to false in production mode. TLS certificate verification must remain enabled.');
  }
}

module.exports = {
  config,
  validateConfig,
  maskConnectionString,
};
