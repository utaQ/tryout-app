const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// On Render (or any host with an attached persistent disk), set DB_DIR to the
// disk's mount path (e.g. /var/data) so the database survives redeploys.
// Without it, the db lives inside the app folder, which is wiped and
// recreated from git on every deploy. Locally this defaults to db/ as before.
const DB_DIR = process.env.DB_DIR || __dirname;
fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'tryouts.db');
const isNew = !fs.existsSync(DB_PATH);
console.log(`Using database at ${DB_PATH}${isNew ? ' (new)' : ''}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed a default admin login if none exists (prototype only — change this!)
const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
if (adminCount === 0) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', 'admin123');
  console.log('Seeded default admin login -> username: admin / password: admin123 (change this!)');
}

module.exports = db;
