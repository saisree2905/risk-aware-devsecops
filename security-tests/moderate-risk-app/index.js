// Moderate Risk Application - Deprecated headers / low severity security smell
const express = require('express');
const app = express();

app.use((req, res, next) => {
  // Missing strict transport security or minor informational advisory
  res.setHeader('X-Powered-By', 'Express');
  next();
});

app.get('/api/info', (req, res) => {
  res.send('Moderate risk endpoint');
});

module.exports = app;
