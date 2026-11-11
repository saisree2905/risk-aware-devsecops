// Safe Application - Minimum viable express app without vulnerabilities
const express = require('express');
const app = express();

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'pong' });
});

module.exports = app;
