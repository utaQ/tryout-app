const express = require('express');
const router = express.Router();
const db = require('../db');

// List players for a session (optionally filter by age group)
router.get('/sessions/:sessionId/players', (req, res) => {
  const { age_group_id } = req.query;
  let sql = `
    SELECT p.*, u.color AS uniform_color, u.number AS uniform_number, ag.name AS age_group_name
    FROM players p
    LEFT JOIN uniforms u ON p.uniform_id = u.id
    LEFT JOIN age_groups ag ON p.age_group_id = ag.id
    WHERE p.session_id = ?`;
  const params = [req.params.sessionId];
  if (age_group_id) { sql += ' AND p.age_group_id = ?'; params.push(age_group_id); }
  sql += ' ORDER BY p.last_name, p.first_name';
  res.json(db.prepare(sql).all(...params));
});

// Create/register a player (not yet checked in)
router.post('/sessions/:sessionId/players', (req, res) => {
  const { first_name, last_name, age_group_id, birthdate, guardian_name, guardian_phone, guardian_email } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
  const info = db.prepare(`
    INSERT INTO players (session_id, age_group_id, first_name, last_name, birthdate, guardian_name, guardian_phone, guardian_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.sessionId, age_group_id || null, first_name, last_name, birthdate || null, guardian_name || null, guardian_phone || null, guardian_email || null);
  res.json({ id: info.lastInsertRowid });
});

router.patch('/players/:id', (req, res) => {
  const fields = ['first_name', 'last_name', 'age_group_id', 'birthdate', 'guardian_name', 'guardian_phone', 'guardian_email'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'no fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Check in a player and assign a uniform, in one transaction
router.post('/players/:id/check-in', (req, res) => {
  const { uniform_id } = req.body;
  if (!uniform_id) return res.status(400).json({ error: 'uniform_id is required' });

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const uniform = db.prepare('SELECT * FROM uniforms WHERE id = ?').get(uniform_id);
  if (!uniform || uniform.session_id !== player.session_id) {
    return res.status(400).json({ error: 'uniform not found for this session' });
  }
  if (uniform.status !== 'available') {
    return res.status(400).json({ error: `uniform is currently ${uniform.status}` });
  }

  const checkIn = db.transaction(() => {
    db.prepare('UPDATE uniforms SET status = ? WHERE id = ?').run('assigned', uniform_id);
    db.prepare(`
      UPDATE players SET uniform_id = ?, checked_in = 1, checked_in_at = datetime('now') WHERE id = ?
    `).run(uniform_id, req.params.id);
  });
  checkIn();
  res.json({ ok: true });
});

// Undo check-in (frees the uniform back up)
router.post('/players/:id/check-out', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const checkOut = db.transaction(() => {
    if (player.uniform_id) {
      db.prepare('UPDATE uniforms SET status = ? WHERE id = ?').run('available', player.uniform_id);
    }
    db.prepare(`UPDATE players SET uniform_id = NULL, checked_in = 0, checked_in_at = NULL WHERE id = ?`).run(req.params.id);
  });
  checkOut();
  res.json({ ok: true });
});

router.delete('/players/:id', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (player && player.uniform_id) {
    db.prepare('UPDATE uniforms SET status = ? WHERE id = ?').run('available', player.uniform_id);
  }
  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
