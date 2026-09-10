const express = require('express');
const router = express.Router();
const db = require('../db');

const MAX = { ball_handling: 25, shooting: 25, defense: 20, basketball_iq: 15, athleticism: 10, coachability: 5 };

function clamp(val, max) {
  const n = Number(val) || 0;
  return Math.max(0, Math.min(max, n));
}

// Get (or create empty) evaluation for a player by a specific coach
router.get('/players/:playerId/evaluations/:coachId', (req, res) => {
  const { playerId, coachId } = req.params;
  let evalRow = db.prepare('SELECT * FROM evaluations WHERE player_id = ? AND coach_id = ?').get(playerId, coachId);
  if (!evalRow) {
    const player = db.prepare('SELECT session_id FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'player not found' });
    return res.json({
      player_id: Number(playerId), coach_id: Number(coachId), session_id: player.session_id,
      ball_handling: 0, shooting: 0, defense: 0, basketball_iq: 0, athleticism: 0, coachability: 0,
      total: 0, recommendation: null, notes: '', submitted: 0
    });
  }
  res.json(evalRow);
});

// All evaluations a coach has done/started for an age group's roster in a session
router.get('/coaches/:coachId/sessions/:sessionId/evaluations', (req, res) => {
  const { age_group_id } = req.query;
  let sql = `
    SELECT p.id AS player_id, p.first_name, p.last_name, p.age_group_id,
           u.color AS uniform_color, u.number AS uniform_number,
           e.id AS evaluation_id, e.ball_handling, e.shooting, e.defense, e.basketball_iq,
           e.athleticism, e.coachability, e.total, e.recommendation, e.notes, e.submitted
    FROM players p
    LEFT JOIN uniforms u ON p.uniform_id = u.id
    LEFT JOIN evaluations e ON e.player_id = p.id AND e.coach_id = ?
    WHERE p.session_id = ?`;
  const params = [req.params.coachId, req.params.sessionId];
  if (age_group_id) { sql += ' AND p.age_group_id = ?'; params.push(age_group_id); }
  sql += ' ORDER BY p.last_name, p.first_name';
  res.json(db.prepare(sql).all(...params));
});

// Create or update (upsert) an evaluation
router.put('/players/:playerId/evaluations/:coachId', (req, res) => {
  const { playerId, coachId } = req.params;
  const player = db.prepare('SELECT session_id FROM players WHERE id = ?').get(playerId);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const b = req.body;
  const vals = {
    ball_handling: clamp(b.ball_handling, MAX.ball_handling),
    shooting: clamp(b.shooting, MAX.shooting),
    defense: clamp(b.defense, MAX.defense),
    basketball_iq: clamp(b.basketball_iq, MAX.basketball_iq),
    athleticism: clamp(b.athleticism, MAX.athleticism),
    coachability: clamp(b.coachability, MAX.coachability),
    recommendation: b.recommendation || null,
    notes: b.notes || '',
    submitted: b.submitted ? 1 : 0,
  };

  const existing = db.prepare('SELECT id, submitted FROM evaluations WHERE player_id = ? AND coach_id = ?').get(playerId, coachId);
  if (existing && existing.submitted && !b.allowEditAfterSubmit) {
    return res.status(409).json({ error: 'This evaluation is already submitted and locked.' });
  }

  if (existing) {
    db.prepare(`
      UPDATE evaluations SET ball_handling=?, shooting=?, defense=?, basketball_iq=?, athleticism=?, coachability=?,
      recommendation=?, notes=?, submitted=?, updated_at=datetime('now') WHERE id=?
    `).run(vals.ball_handling, vals.shooting, vals.defense, vals.basketball_iq, vals.athleticism, vals.coachability,
      vals.recommendation, vals.notes, vals.submitted, existing.id);
    res.json({ id: existing.id, ok: true });
  } else {
    const info = db.prepare(`
      INSERT INTO evaluations (session_id, player_id, coach_id, ball_handling, shooting, defense, basketball_iq, athleticism, coachability, recommendation, notes, submitted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(player.session_id, playerId, coachId, vals.ball_handling, vals.shooting, vals.defense, vals.basketball_iq,
      vals.athleticism, vals.coachability, vals.recommendation, vals.notes, vals.submitted);
    res.json({ id: info.lastInsertRowid, ok: true });
  }
});

// --- Reports ---

// All evaluations for a single player, from every coach, with average
router.get('/players/:playerId/evaluations', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, c.name AS coach_name
    FROM evaluations e JOIN coaches c ON e.coach_id = c.id
    WHERE e.player_id = ?
    ORDER BY c.name
  `).all(req.params.playerId);
  const avg = rows.length ? rows.reduce((s, r) => s + r.total, 0) / rows.length : null;
  res.json({ evaluations: rows, average_total: avg });
});

// Leaderboard for an age group: average total across all coaches per player
router.get('/sessions/:sessionId/age-groups/:ageGroupId/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id AS player_id, p.first_name, p.last_name,
           u.color AS uniform_color, u.number AS uniform_number,
           COUNT(e.id) AS eval_count,
           AVG(e.total) AS average_total,
           GROUP_CONCAT(DISTINCT e.recommendation) AS recommendations
    FROM players p
    LEFT JOIN uniforms u ON p.uniform_id = u.id
    LEFT JOIN evaluations e ON e.player_id = p.id AND e.submitted = 1
    WHERE p.session_id = ? AND p.age_group_id = ?
    GROUP BY p.id
    ORDER BY average_total DESC NULLS LAST, p.last_name
  `).all(req.params.sessionId, req.params.ageGroupId);
  res.json(rows);
});

module.exports = router;
