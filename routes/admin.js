const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT id, username FROM admins WHERE username = ? AND password = ?').get(username, password);
  if (!admin) return res.status(401).json({ error: 'invalid credentials' });
  res.json(admin);
});

module.exports = router;
