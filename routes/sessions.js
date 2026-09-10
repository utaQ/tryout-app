const express = require('express');
const router = express.Router();
const db = require('../db');

// --- Sessions ---
router.get('/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY session_date DESC, id DESC').all();
  res.json(sessions);
});

router.post('/sessions', (req, res) => {
  const { name, session_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO sessions (name, session_date) VALUES (?, ?)').run(name, session_date || null);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Age groups ---
router.get('/sessions/:sessionId/age-groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM age_groups WHERE session_id = ? ORDER BY sort_order, id').all(req.params.sessionId);
  res.json(groups);
});

router.post('/sessions/:sessionId/age-groups', (req, res) => {
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO age_groups (session_id, name, sort_order) VALUES (?, ?, ?)')
    .run(req.params.sessionId, name, sort_order || 0);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/age-groups/:id', (req, res) => {
  db.prepare('DELETE FROM age_groups WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
