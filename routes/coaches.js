const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/coaches', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, pin FROM coaches ORDER BY name').all());
});

router.post('/coaches', (req, res) => {
  const { name, email, pin } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO coaches (name, email, pin) VALUES (?, ?, ?)').run(name, email || null, pin || null);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/coaches/:id', (req, res) => {
  db.prepare('DELETE FROM coaches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Assign a coach to an age group
router.post('/coaches/:id/age-groups/:ageGroupId', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO coach_age_groups (coach_id, age_group_id) VALUES (?, ?)')
    .run(req.params.id, req.params.ageGroupId);
  res.json({ ok: true });
});

router.delete('/coaches/:id/age-groups/:ageGroupId', (req, res) => {
  db.prepare('DELETE FROM coach_age_groups WHERE coach_id = ? AND age_group_id = ?')
    .run(req.params.id, req.params.ageGroupId);
  res.json({ ok: true });
});

// Get a coach's assigned age groups (with session info)
router.get('/coaches/:id/age-groups', (req, res) => {
  const rows = db.prepare(`
    SELECT ag.*, s.name AS session_name
    FROM coach_age_groups cag
    JOIN age_groups ag ON cag.age_group_id = ag.id
    JOIN sessions s ON ag.session_id = s.id
    WHERE cag.coach_id = ?
    ORDER BY s.session_date DESC, ag.sort_order
  `).all(req.params.id);
  res.json(rows);
});

// Simple coach login by PIN (prototype-level auth)
router.post('/coaches/login', (req, res) => {
  const { pin } = req.body;
  const coach = db.prepare('SELECT id, name, email FROM coaches WHERE pin = ?').get(pin);
  if (!coach) return res.status(401).json({ error: 'invalid PIN' });
  res.json(coach);
});

module.exports = router;
