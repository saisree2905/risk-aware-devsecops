const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { config } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const scanRoutes = require('./routes/scan.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));

// Limit request body size to 10MB to accommodate large scanner JSON reports
// while preventing denial-of-service via unbounded payloads.
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/scans', scanRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.json({
    name: 'Risk-Aware DevSecOps Framework API',
    status: 'running',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
