// Vulnerable Application - Obvious SQL injection and hardcoded secret pattern
const express = require('express');
const app = express();

const JWT_SECRET = 'SUPER_SECRET_HARDCODED_KEY_12345';

app.get('/api/users', (req, res) => {
  const userId = req.query.id;
  // Raw SQL query concatenation (SQL Injection vulnerability)
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  res.send('Executing: ' + query);
});

module.exports = app;
