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
  databaseUrl: process.env.DATABASE_URL,
  dbPool: {
    max: parseInt(process.env.DB_POOL_MAX || '2', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  apiKey: process.env.API_KEY || 'devsecops_dev_key',
  maskConnectionString,
};

function validateConfig() {
  if (!config.databaseUrl) {
    throw new Error('Missing required configuration: DATABASE_URL is not set.');
  }
}

module.exports = {
  config,
  validateConfig,
  maskConnectionString,
};
