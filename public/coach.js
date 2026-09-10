const RUBRIC = [
  { key: 'ball_handling', label: 'Ball Handling', max: 25 },
  { key: 'shooting', label: 'Shooting', max: 25 },
  { key: 'defense', label: 'Defense', max: 20 },
  { key: 'basketball_iq', label: 'Basketball IQ', max: 15 },
  { key: 'athleticism', label: 'Athleticism', max: 10 },
  { key: 'coachability', label: 'Coachability', max: 5 }
];
const RECOMMENDATIONS = ['Make', 'Maybe', 'Callback', 'Cut'];

let state = {
  coach: null,
  ageGroups: [],       // this coach's assigned age groups (across sessions)
  currentAgeGroupId: null,
  currentSessionId: null,
  roster: [],
  currentEval: null,   // in-progress evaluation object while editing a player
  currentPlayer: null,
  allowEdit: false
};

// ---------- PIN entry ----------
let pinBuffer = '';

function pinPress(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  renderPin();
  if (pinBuffer.length === 4) attemptLogin();
}
function pinBackspace() { pinBuffer = pinBuffer.slice(0, -1); renderPin(); }
function pinClear() { pinBuffer = ''; renderPin(); document.getElementById('pinError').innerHTML = ''; }
function renderPin() { document.getElementById('pinDisplay').textContent = '•'.repeat(pinBuffer.length); }

async function attemptLogin() {
  try {
    const coach = await API.post('/coaches/login', { pin: pinBuffer });
    state.coach = coach;
    sessionStorage.setItem('coach', JSON.stringify(coach));
    boot();
  } catch (e) {
    document.getElementById('pinError').innerHTML = `<div class="error-msg">Invalid PIN</div>`;
    pinBuffer = '';
    renderPin();
  }
}

function logout() {
  sessionStorage.removeItem('coach');
  location.reload();
}

// ---------- Boot ----------
async function boot() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  document.getElementById('coachName').textContent = state.coach.name;

  state.ageGroups = await API.get(`/coaches/${state.coach.id}/age-groups`);
  if (!state.ageGroups.length) {
    document.getElementById('mainContainer').innerHTML = `<div class="card muted">You haven't been assigned to any age groups yet. Check with your admin.</div>`;
    return;
  }
  state.currentAgeGroupId = state.ageGroups[0].id;
  state.currentSessionId = state.ageGroups[0].session_id;
  renderRoster();
}

// ---------- Roster ----------
async function renderRoster() {
  const group = state.ageGroups.find(g => g.id === state.currentAgeGroupId);
  state.roster = await API.get(`/coaches/${state.coach.id}/sessions/${group.session_id}/evaluations?age_group_id=${group.id}`);

  const el = document.getElementById('mainContainer');
  el.innerHTML = `
    ${state.ageGroups.length > 1 ? `
      <div class="card">
        <label>Age Group</label>
        <select onchange="switchAgeGroup(this.value)">
          ${state.ageGroups.map(g => `<option value="${g.id}" ${g.id === state.currentAgeGroupId ? 'selected' : ''}>${escapeHtml(g.session_name)} — ${escapeHtml(g.name)}</option>`).join('')}
        </select>
      </div>
    ` : `<div class="card"><strong>${escapeHtml(group.session_name)} — ${escapeHtml(group.name)}</strong></div>`}

    <div class="card">
      <h2>Roster (${state.roster.length})</h2>
      ${state.roster.map(p => `
        <div class="player-card" onclick="openEvalForm(${p.player_id})">
          <div>
            <div class="player-name">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</div>
            ${p.uniform_color ? `<span class="uniform-chip" style="background:${colorHex(p.uniform_color)}; margin-top:4px;">${escapeHtml(p.uniform_color)} #${p.uniform_number}</span>` : '<span class="muted">No uniform assigned</span>'}
          </div>
          <div style="text-align:right;">
            ${p.submitted ? `<span class="badge available">Submitted · ${p.total}/100</span>` : (p.evaluation_id ? `<span class="badge assigned">Draft · ${p.total}/100</span>` : `<span class="badge lost">Not started</span>`)}
          </div>
        </div>
      `).join('') || '<p class="muted">No players in this age group yet.</p>'}
    </div>
  `;
}

function switchAgeGroup(id) {
  state.currentAgeGroupId = Number(id);
  renderRoster();
}

// ---------- Evaluation form ----------
async function openEvalForm(playerId) {
  const player = state.roster.find(p => p.player_id === playerId);
  const evalData = await API.get(`/players/${playerId}/evaluations/${state.coach.id}`);
  state.currentPlayer = player;
  state.currentEval = evalData;
  state.allowEdit = !evalData.submitted;
  renderEvalForm();
}

function renderEvalForm() {
  const p = state.currentPlayer;
  const e = state.currentEval;
  const total = RUBRIC.reduce((sum, r) => sum + (e[r.key] || 0), 0);

  const el = document.getElementById('mainContainer');
  el.innerHTML = `
    <button class="btn secondary small" style="margin-bottom:14px;" onclick="renderRoster()">← Back to Roster</button>

    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <div class="player-name" style="font-size:20px;">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</div>
          ${p.uniform_color ? `<span class="uniform-chip" style="background:${colorHex(p.uniform_color)}; margin-top:6px;">${escapeHtml(p.uniform_color)} #${p.uniform_number}</span>` : ''}
        </div>
        ${e.submitted && !state.allowEdit ? `<button class="btn secondary small" onclick="unlockEval()">Unlock to Edit</button>` : ''}
      </div>
    </div>

    <div class="total-banner">
      <span>Total</span>
      <span id="totalDisplay">${total} / 100</span>
    </div>

    ${e.submitted && !state.allowEdit ? `<p class="locked-note">This evaluation was submitted and is locked. Tap "Unlock to Edit" above to make changes.</p>` : ''}

    <div class="card">
      ${RUBRIC.map(r => `
        <div class="score-group">
          <div class="score-group-header">
            <span class="label">${r.label}</span>
            <span class="value">${e[r.key] || 0} / ${r.max}</span>
          </div>
          <div class="score-buttons">
            ${range(0, r.max, 5).map(v => `
              <button class="score-btn ${e[r.key] === v ? 'selected' : ''}" ${!state.allowEdit ? 'disabled' : ''}
                onclick="setScore('${r.key}', ${v})">${v}</button>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <label>Recommendation</label>
      <select id="recommendationSelect" ${!state.allowEdit ? 'disabled' : ''} onchange="state.currentEval.recommendation = this.value">
        <option value="">— Select —</option>
        ${RECOMMENDATIONS.map(r => `<option value="${r}" ${e.recommendation === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>

      <label>Notes</label>
      <textarea id="notesInput" ${!state.allowEdit ? 'disabled' : ''} oninput="state.currentEval.notes = this.value">${escapeHtml(e.notes || '')}</textarea>

      ${state.allowEdit ? `
        <div class="row" style="margin-top:16px;">
          <button class="btn secondary" onclick="saveEval(false)">Save Draft</button>
          <button class="btn" onclick="saveEval(true)">Submit Final</button>
        </div>
      ` : ''}
      <div id="evalMsg"></div>
    </div>
  `;
}

function range(start, end, step) {
  const out = [];
  for (let v = start; v <= end; v += step) out.push(v);
  return out;
}

function setScore(key, value) {
  state.currentEval[key] = value;
  renderEvalForm();
}

function unlockEval() {
  state.allowEdit = true;
  renderEvalForm();
}

async function saveEval(submit) {
  const e = state.currentEval;
  try {
    await API.put(`/players/${state.currentPlayer.player_id}/evaluations/${state.coach.id}`, {
      ball_handling: e.ball_handling || 0,
      shooting: e.shooting || 0,
      defense: e.defense || 0,
      basketball_iq: e.basketball_iq || 0,
      athleticism: e.athleticism || 0,
      coachability: e.coachability || 0,
      recommendation: e.recommendation || null,
      notes: e.notes || '',
      submitted: submit,
      allowEditAfterSubmit: true
    });
    document.getElementById('evalMsg').innerHTML = `<div class="success-msg">${submit ? 'Submitted!' : 'Draft saved.'}</div>`;
    if (submit) {
      state.currentEval.submitted = 1;
      state.allowEdit = false;
      setTimeout(() => renderRoster(), 700);
    }
  } catch (err) {
    document.getElementById('evalMsg').innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Init ----------
(function init() {
  renderPin();
  const saved = sessionStorage.getItem('coach');
  if (saved) { state.coach = JSON.parse(saved); boot(); }
})();
