// Seeds the database with sample data for testing/demo purposes.
// Run with: npm run seed
// Safe to re-run — it wipes existing sessions/players/coaches/uniforms first
// (the admin login is left untouched).

const db = require('./db');

console.log('Clearing existing session data...');
db.exec(`
  DELETE FROM evaluations;
  DELETE FROM coach_age_groups;
  DELETE FROM players;
  DELETE FROM uniforms;
  DELETE FROM age_groups;
  DELETE FROM coaches;
  DELETE FROM sessions;
`);

console.log('Creating session...');
const sessionId = db.prepare('INSERT INTO sessions (name, session_date) VALUES (?, ?)')
  .run('Fall 2026 Tryouts', '2026-09-13').lastInsertRowid;

console.log('Creating age groups...');
const ageGroup12U = db.prepare('INSERT INTO age_groups (session_id, name, sort_order) VALUES (?, ?, ?)')
  .run(sessionId, '12U', 0).lastInsertRowid;
const ageGroup14U = db.prepare('INSERT INTO age_groups (session_id, name, sort_order) VALUES (?, ?, ?)')
  .run(sessionId, '14U', 1).lastInsertRowid;

console.log('Creating uniforms (Green, Yellow, Teal — #1-10 each)...');
const insertUniform = db.prepare('INSERT INTO uniforms (session_id, color, number, status) VALUES (?, ?, ?, ?)');
const colors = ['Green', 'Yellow', 'Teal'];
for (const color of colors) {
  for (let n = 1; n <= 10; n++) {
    insertUniform.run(sessionId, color, n, 'available');
  }
}

console.log('Creating coaches...');
const coach1 = db.prepare('INSERT INTO coaches (name, pin) VALUES (?, ?)').run('Coach Taylor', '1111').lastInsertRowid;
const coach2 = db.prepare('INSERT INTO coaches (name, pin) VALUES (?, ?)').run('Coach Morgan', '2222').lastInsertRowid;
db.prepare('INSERT INTO coach_age_groups (coach_id, age_group_id) VALUES (?, ?)').run(coach1, ageGroup12U);
db.prepare('INSERT INTO coach_age_groups (coach_id, age_group_id) VALUES (?, ?)').run(coach1, ageGroup14U);
db.prepare('INSERT INTO coach_age_groups (coach_id, age_group_id) VALUES (?, ?)').run(coach2, ageGroup12U);

console.log('Creating sample players and checking them in...');
const insertPlayer = db.prepare(`
  INSERT INTO players (session_id, age_group_id, first_name, last_name, guardian_name, guardian_phone)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const findAvailableUniform = db.prepare(`
  SELECT id FROM uniforms WHERE session_id = ? AND color = ? AND status = 'available' ORDER BY number LIMIT 1
`);
const assignUniform = db.prepare('UPDATE uniforms SET status = ? WHERE id = ?');
const checkInPlayer = db.prepare(`UPDATE players SET uniform_id = ?, checked_in = 1, checked_in_at = datetime('now') WHERE id = ?`);

function addPlayer(ageGroupId, first, last, color, guardian, phone) {
  const playerId = insertPlayer.run(sessionId, ageGroupId, first, last, guardian, phone).lastInsertRowid;
  const uniform = findAvailableUniform.get(sessionId, color);
  if (uniform) {
    assignUniform.run('assigned', uniform.id);
    checkInPlayer.run(uniform.id, playerId);
  }
  return playerId;
}

// 12U roster — mixed
const p1 = addPlayer(ageGroup12U, 'Maya', 'Robinson', 'Green', 'Lisa Robinson', '555-0101');
const p2 = addPlayer(ageGroup12U, 'Ethan', 'Kim', 'Green', 'David Kim', '555-0102');
const p3 = addPlayer(ageGroup12U, 'Sofia', 'Alvarez', 'Yellow', 'Carla Alvarez', '555-0103');
const p4 = addPlayer(ageGroup12U, 'Liam', 'Johnson', 'Yellow', 'Marcus Johnson', '555-0104');
const p5 = addPlayer(ageGroup12U, 'Ava', 'Nguyen', 'Teal', 'Trang Nguyen', '555-0105');
const p6 = addPlayer(ageGroup12U, 'Noah', 'Williams', 'Teal', 'Denise Williams', '555-0106');

// 14U roster — mixed
const p7 = addPlayer(ageGroup14U, 'Grace', 'Thompson', 'Green', 'Karen Thompson', '555-0201');
const p8 = addPlayer(ageGroup14U, 'Jackson', 'Davis', 'Green', 'Robert Davis', '555-0202');
const p9 = addPlayer(ageGroup14U, 'Zoe', 'Martinez', 'Yellow', 'Elena Martinez', '555-0203');
const p10 = addPlayer(ageGroup14U, 'Mason', 'Brooks', 'Yellow', 'Angela Brooks', '555-0204');
const p11 = addPlayer(ageGroup14U, 'Chloe', 'Patel', 'Teal', 'Anita Patel', '555-0205');
const p12 = addPlayer(ageGroup14U, 'Lucas', 'Bennett', 'Teal', 'Steve Bennett', '555-0206');

console.log('Adding a few sample evaluations...');
const insertEval = db.prepare(`
  INSERT INTO evaluations (session_id, player_id, coach_id, ball_handling, shooting, defense, basketball_iq, athleticism, coachability, recommendation, notes, submitted)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertEval.run(sessionId, p1, coach1, 20, 20, 15, 10, 10, 5, 'Make', 'Great court vision, natural leader.', 1);
insertEval.run(sessionId, p1, coach2, 20, 15, 15, 15, 10, 5, 'Callback', 'Want to see her against tougher defense.', 1);
insertEval.run(sessionId, p2, coach1, 15, 10, 15, 10, 5, 5, 'Maybe', 'Solid fundamentals, needs more reps.', 1);
insertEval.run(sessionId, p3, coach1, 25, 20, 10, 10, 10, 5, 'Make', 'Best handles in the group.', 1);
insertEval.run(sessionId, p4, coach2, 10, 10, 10, 5, 5, 5, 'Cut', 'Struggled to keep pace today.', 1);
insertEval.run(sessionId, p5, coach1, 15, 15, 20, 15, 10, 5, 'Make', 'Lockdown defender, very coachable.', 0); // draft, not yet submitted

console.log('\nDone! Seeded:');
console.log(`  Session: Fall 2026 Tryouts (id ${sessionId})`);
console.log('  Age groups: 12U, 14U');
console.log('  Uniforms: Green/Yellow/Teal, #1-10 each (30 total, some now assigned)');
console.log('  Coaches: Coach Taylor (PIN 1111, both groups), Coach Morgan (PIN 2222, 12U only)');
console.log('  Players: 6 in 12U, 6 in 14U, all checked in with uniforms');
console.log('  Evaluations: a handful of sample submitted scores + one draft');
console.log('\nAdmin login: admin / admin123');
