-- Basketball Tryout Evaluation App Schema

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,               -- e.g. "Fall 2026 Tryouts - Day 1"
  session_date TEXT,                -- ISO date
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS age_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g. "10U", "12U", "15U"
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  pin TEXT,                         -- simple PIN/passcode login for coaches
  created_at TEXT DEFAULT (datetime('now'))
);

-- Which coaches are assigned to which age groups (many-to-many)
CREATE TABLE IF NOT EXISTS coach_age_groups (
  coach_id INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  age_group_id INTEGER NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (coach_id, age_group_id)
);

-- Uniform inventory: each color+number combo, scoped to a session
CREATE TABLE IF NOT EXISTS uniforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- available | assigned | lost | damaged
  UNIQUE(session_id, color, number)
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  age_group_id INTEGER REFERENCES age_groups(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthdate TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  uniform_id INTEGER REFERENCES uniforms(id),
  checked_in INTEGER DEFAULT 0,     -- 0/1
  checked_in_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  coach_id INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  ball_handling INTEGER DEFAULT 0,   -- /25
  shooting INTEGER DEFAULT 0,        -- /25
  defense INTEGER DEFAULT 0,         -- /20
  basketball_iq INTEGER DEFAULT 0,   -- /15
  athleticism INTEGER DEFAULT 0,     -- /10
  coachability INTEGER DEFAULT 0,    -- /5
  total INTEGER GENERATED ALWAYS AS (
    ball_handling + shooting + defense + basketball_iq + athleticism + coachability
  ) VIRTUAL,
  recommendation TEXT,               -- e.g. Make / Cut / Callback
  notes TEXT,
  submitted INTEGER DEFAULT 0,       -- 0 = draft/autosaved, 1 = locked/submitted
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(player_id, coach_id)
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL  -- plain for prototype; hash before real deployment
);
