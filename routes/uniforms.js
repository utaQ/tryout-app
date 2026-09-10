const express = require('express');
const router = express.Router();
const db = require('../db');

// List all uniforms for a session (optionally filter by status/color)
router.get('/sessions/:sessionId/uniforms', (req, res) => {
  const { status, color } = req.query;
  let sql = 'SELECT * FROM uniforms WHERE session_id = ?';
  const params = [req.params.sessionId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (color) { sql += ' AND color = ?'; params.push(color); }
  sql += ' ORDER BY color, number';
  res.json(db.prepare(sql).all(...params));
});

// Bulk-create a range of uniforms for a color, e.g. Green 1-20
router.post('/sessions/:sessionId/uniforms/bulk', (req, res) => {
  const { color, start, end } = req.body;
  if (!color || start == null || end == null) {
    return res.status(400).json({ error: 'color, start, and end are required' });
  }
  const insert = db.prepare('INSERT OR IGNORE INTO uniforms (session_id, color, number, status) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((rows) => {
    for (const n of rows) insert.run(req.params.sessionId, color, n, 'available');
  });
  const numbers = [];
  for (let n = start; n <= end; n++) numbers.push(n);
  insertMany(numbers);
  res.json({ created: numbers.length });
});

// Add a single uniform
router.post('/sessions/:sessionId/uniforms', (req, res) => {
  const { color, number } = req.body;
  if (!color || number == null) return res.status(400).json({ error: 'color and number are required' });
  try {
    const info = db.prepare('INSERT INTO uniforms (session_id, color, number, status) VALUES (?, ?, ?, ?)')
      .run(req.params.sessionId, color, number, 'available');
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'That color/number combo already exists for this session.' });
  }
});

// Update a uniform's status (available, lost, damaged, assigned handled via player check-in)
router.patch('/uniforms/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE uniforms SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.delete('/uniforms/:id', (req, res) => {
  db.prepare('DELETE FROM uniforms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
