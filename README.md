# Basketball Tryout Evaluation App

A self-contained web app for managing tryouts: uniform inventory, player check-in, coach evaluations, and reports. Built with Node/Express + SQLite (no external database needed) and plain HTML/JS (no build step).

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:3000** in a browser.

The database file (`db/tryouts.db`) is created automatically on first run, empty. To load it with sample test data so you can click around immediately:
```bash
npm run seed
```

To reset and reload the sample data at any point, just run the same command again:
```bash
npm run seed
```
This wipes all sessions/players/coaches/uniforms/evaluations and recreates the sample set below. It leaves the admin login untouched. To start completely empty instead, just stop the server and delete `db/tryouts.db`.

## Sample test data included

- **Session**: "Fall 2026 Tryouts"
- **Age groups**: 12U and 14U
- **Uniforms**: Green, Yellow, and Teal, numbers 1–10 each (30 total) — some already assigned to players, some still available so you can try the check-in flow
- **Coaches**: Coach Taylor (PIN `1111`, assigned to both 12U and 14U) and Coach Morgan (PIN `2222`, assigned to 12U only)
- **Players**: 6 in 12U, 6 in 14U, all checked in with uniforms assigned
- **Evaluations**: a handful of pre-filled sample scores (including one still-a-draft) so the Reports tab and leaderboard have something to show right away

## Logging in

- **Admin**: username `admin`, password `admin123` (change this — see below).
- **Coach**: 4-digit PIN, set by the admin when creating each coach in the Coaches tab. Try `1111` (Coach Taylor) or `2222` (Coach Morgan) with the sample data.

### Changing the admin password
Easiest way for now: stop the server, delete `db/tryouts.db`, and edit the seed line in `db/index.js` before restarting. (For real deployment, swap in a hashed password and a login form that doesn't pre-fill credentials.)

## How it's organized

- **Setup tab** — create a tryout session (e.g. "Fall 2026 Tryouts") and its age groups (10U, 12U, 15U, etc.)
- **Uniforms tab** — bulk-add a color and number range (e.g. Green 1–20) or add uniforms one at a time; mark uniforms lost/damaged
- **Check-In tab** — register a player, assign them the next available uniform, check them in (this locks that uniform as "assigned" until checked out)
- **Coaches tab** — add coaches with a PIN and assign them to the age groups they'll evaluate
- **Reports tab** — leaderboard per age group (average score across all coaches who evaluated a player), player detail view showing every coach's individual scores/notes, and CSV export

Coaches sign in with their PIN, see only their assigned age group(s), and fill out the scoring rubric:

| Category | Points |
|---|---|
| Ball Handling | /25 |
| Shooting | /25 |
| Defense | /20 |
| Basketball IQ | /15 |
| Athleticism | /10 |
| Coachability | /5 |
| **Total** | **/100** |

Scores are entered by tapping buttons in increments of 5. Recommendation is one of Make / Maybe / Callback / Cut. Evaluations can be saved as a draft and edited freely; once **Submitted**, they lock (a coach can still tap "Unlock to Edit" if they need to fix something).

## Notes on this being a prototype

- Auth is intentionally simple (plaintext password / PIN match) — fine for a private local deployment on trusted devices at tryouts, but should be hardened (hashed passwords, real sessions) before exposing it on the open internet.
- Data lives in a single SQLite file, so back it up (`db/tryouts.db`) after tryouts if you want to keep records.
- To run this on tablets at the gym, you'd host it on a laptop on the same WiFi and have devices browse to that laptop's local IP (e.g. `http://192.168.1.x:3000`) instead of `localhost`.

## Deploying (Render)

This app stores everything in a single SQLite file, so the one thing that matters in production is making sure that file lives on **persistent disk**, not inside the app's code checkout (which Render wipes and recreates from git on every deploy).

1. In the Render dashboard, open the service → **Disks** tab → attach a disk if you haven't already (any size is fine — the db file is tiny) and note its **mount path** (e.g. `/var/data`).
2. Open the **Environment** tab and add:
   - `DB_DIR` = the exact same mount path you set in step 1 (e.g. `/var/data`)
3. Deploy (or redeploy). On startup the app logs the path it's using, e.g. `Using database at /var/data/tryouts.db` — check the logs to confirm it's pointing at the disk, not `.../db/tryouts.db`.
4. The disk starts empty, so the app boots with just the default admin login (`admin` / `admin123`, seeded automatically — change it, see above). If you want the sample data too, open a shell on the Render service (Shell tab) and run `npm run seed` once.

Without `DB_DIR` set, the app falls back to `db/tryouts.db` inside the checkout, which is fine for local dev but means all data is lost on every deploy — that's the behavior this section fixes.

## Project structure

```
tryout-app/
├── server.js           # Express app entry point
├── db/
│   ├── schema.sql       # Table definitions
│   └── index.js         # DB connection + auto-migration + admin seed
├── routes/
│   ├── admin.js
│   ├── sessions.js
│   ├── uniforms.js
│   ├── players.js
│   ├── coaches.js
│   └── evaluations.js
└── public/               # Frontend (vanilla HTML/CSS/JS)
    ├── index.html
    ├── admin.html / admin.js
    ├── coach.html / coach.js
    ├── app.js            # shared fetch helpers
    └── style.css
```
