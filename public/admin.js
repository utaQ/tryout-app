// ---------- State ----------
let state = {
  admin: null,
  sessions: [],
  currentSessionId: null,
  ageGroups: [],
  uniforms: [],
  players: [],
  coaches: []
};

// ---------- Auth ----------
function loadAuth() {
  const saved = sessionStorage.getItem('admin');
  if (saved) state.admin = JSON.parse(saved);
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const admin = await API.post('/admin/login', { username, password });
    state.admin = admin;
    sessionStorage.setItem('admin', JSON.stringify(admin));
    boot();
  } catch (e) {
    document.getElementById('loginError').innerHTML = `<div class="error-msg">${escapeHtml(e.message)}</div>`;
  }
}

function logout() {
  sessionStorage.removeItem('admin');
  location.reload();
}

// ---------- Boot ----------
async function boot() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  await loadSessions();
  showTab('setup');
}

async function loadSessions() {
  state.sessions = await API.get('/sessions');
  if (!state.currentSessionId && state.sessions.length) {
    state.currentSessionId = state.sessions[0].id;
  }
  renderSessionPicker();
  if (state.currentSessionId) await loadSessionData();
}

async function loadSessionData() {
  if (!state.currentSessionId) return;
  state.ageGroups = await API.get(`/sessions/${state.currentSessionId}/age-groups`);
  state.uniforms = await API.get(`/sessions/${state.currentSessionId}/uniforms`);
  state.players = await API.get(`/sessions/${state.currentSessionId}/players`);
}

function renderSessionPicker() {
  const el = document.getElementById('sessionPicker');
  if (!state.sessions.length) { el.innerHTML = 'No sessions yet'; return; }
  el.innerHTML = `Session:
    <select onchange="switchSession(this.value)" style="padding:4px;">
      ${state.sessions.map(s => `<option value="${s.id}" ${s.id === state.currentSessionId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
    </select>`;
}

async function switchSession(id) {
  state.currentSessionId = Number(id);
  await loadSessionData();
  showTab(getActiveTab());
}

function getActiveTab() {
  const active = document.querySelector('.tab.active');
  return active ? active.dataset.tab : 'setup';
}

// ---------- Tabs ----------
function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  const renderers = { setup: renderSetup, uniforms: renderUniforms, checkin: renderCheckin, coaches: renderCoaches, reports: renderReports };
  renderers[tab]();
}

// ================= SETUP TAB =================
function renderSetup() {
  const el = document.getElementById('tab-setup');
  el.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h2>Create Session</h2>
        <label>Session name</label>
        <input type="text" id="newSessionName" placeholder="e.g. Fall 2026 Tryouts - Day 1">
        <label>Date</label>
        <input type="date" id="newSessionDate">
        <button class="btn" style="margin-top:14px;" onclick="createSession()">Create Session</button>
      </div>
      <div class="card">
        <h2>All Sessions</h2>
        <table>
          <thead><tr><th>Name</th><th>Date</th><th></th></tr></thead>
          <tbody>
            ${state.sessions.map(s => `
              <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.session_date || '')}</td>
                <td><button class="btn danger small" onclick="deleteSession(${s.id})">Delete</button></td>
              </tr>`).join('') || '<tr><td colspan="3" class="muted">No sessions yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Age Groups ${state.currentSessionId ? '' : '<span class="muted">(create/select a session first)</span>'}</h2>
      ${state.currentSessionId ? `
        <div class="row">
          <input type="text" id="newAgeGroupName" placeholder="e.g. 15U" style="max-width:200px;">
          <button class="btn secondary" onclick="createAgeGroup()">Add Age Group</button>
        </div>
        <table style="margin-top:14px;">
          <thead><tr><th>Name</th><th>Players</th><th></th></tr></thead>
          <tbody>
            ${state.ageGroups.map(g => `
              <tr>
                <td>${escapeHtml(g.name)}</td>
                <td>${state.players.filter(p => p.age_group_id === g.id).length}</td>
                <td><button class="btn danger small" onclick="deleteAgeGroup(${g.id})">Delete</button></td>
              </tr>`).join('') || '<tr><td colspan="3" class="muted">No age groups yet</td></tr>'}
          </tbody>
        </table>
      ` : ''}
    </div>
  `;
}

async function createSession() {
  const name = document.getElementById('newSessionName').value.trim();
  const session_date = document.getElementById('newSessionDate').value;
  if (!name) return alert('Session name is required');
  const { id } = await API.post('/sessions', { name, session_date });
  state.currentSessionId = id;
  await loadSessions();
  showTab('setup');
}

async function deleteSession(id) {
  if (!confirm('Delete this session and all its data?')) return;
  await API.del(`/sessions/${id}`);
  if (state.currentSessionId === id) state.currentSessionId = null;
  await loadSessions();
  showTab('setup');
}

async function createAgeGroup() {
  const name = document.getElementById('newAgeGroupName').value.trim();
  if (!name) return alert('Age group name is required');
  await API.post(`/sessions/${state.currentSessionId}/age-groups`, { name, sort_order: state.ageGroups.length });
  await loadSessionData();
  showTab('setup');
}

async function deleteAgeGroup(id) {
  if (!confirm('Delete this age group?')) return;
  await API.del(`/age-groups/${id}`);
  await loadSessionData();
  showTab('setup');
}

// ================= UNIFORMS TAB =================
function renderUniforms() {
  const el = document.getElementById('tab-uniforms');
  if (!state.currentSessionId) { el.innerHTML = '<div class="card muted">Create/select a session first.</div>'; return; }

  const byColor = {};
  state.uniforms.forEach(u => { (byColor[u.color] = byColor[u.color] || []).push(u); });

  el.innerHTML = `
    <div class="card">
      <h2>Add Uniforms</h2>
      <div class="row">
        <div>
          <label>Color</label>
          <input type="text" id="bulkColor" placeholder="e.g. Green" style="max-width:160px;">
        </div>
        <div>
          <label>From #</label>
          <input type="number" id="bulkStart" value="1" style="max-width:90px;">
        </div>
        <div>
          <label>To #</label>
          <input type="number" id="bulkEnd" value="20" style="max-width:90px;">
        </div>
        <button class="btn" style="margin-top:20px;" onclick="bulkAddUniforms()">Add Range</button>
      </div>
    </div>

    <div class="card">
      <h2>Inventory</h2>
      ${Object.keys(byColor).length === 0 ? '<p class="muted">No uniforms added yet.</p>' : Object.entries(byColor).map(([color, list]) => `
        <h3 style="margin-top:18px;">${escapeHtml(color)} <span class="muted">(${list.length})</span></h3>
        <div class="row">
          ${list.sort((a,b) => a.number - b.number).map(u => `
            <div class="uniform-chip" style="background:${colorHex(color)};" title="Status: ${u.status}">
              #${u.number}
              <select onchange="changeUniformStatus(${u.id}, this.value)" style="border:none; background:transparent; color:white; font-weight:700; font-size:12px;">
                <option value="available" ${u.status==='available'?'selected':''}>Avail</option>
                <option value="assigned" ${u.status==='assigned'?'selected':''}>Assigned</option>
                <option value="lost" ${u.status==='lost'?'selected':''}>Lost</option>
                <option value="damaged" ${u.status==='damaged'?'selected':''}>Damaged</option>
              </select>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

async function bulkAddUniforms() {
  const color = document.getElementById('bulkColor').value.trim();
  const start = Number(document.getElementById('bulkStart').value);
  const end = Number(document.getElementById('bulkEnd').value);
  if (!color || !start || !end || end < start) return alert('Enter a valid color and number range');
  await API.post(`/sessions/${state.currentSessionId}/uniforms/bulk`, { color, start, end });
  await loadSessionData();
  showTab('uniforms');
}

async function changeUniformStatus(id, status) {
  await API.patch(`/uniforms/${id}`, { status });
  await loadSessionData();
  showTab('uniforms');
}

// ================= CHECK-IN TAB =================
function renderCheckin() {
  const el = document.getElementById('tab-checkin');
  if (!state.currentSessionId) { el.innerHTML = '<div class="card muted">Create/select a session first.</div>'; return; }

  el.innerHTML = `
    <div class="card">
      <h2>Register / Check In a Player</h2>
      <div class="grid-2">
        <div>
          <label>First name</label>
          <input type="text" id="pFirst">
          <label>Last name</label>
          <input type="text" id="pLast">
          <label>Age group</label>
          <select id="pAgeGroup">
            <option value="">— Select —</option>
            ${state.ageGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Guardian name</label>
          <input type="text" id="pGuardianName">
          <label>Guardian phone</label>
          <input type="tel" id="pGuardianPhone">
          <label>Guardian email</label>
          <input type="email" id="pGuardianEmail">
        </div>
      </div>
      <button class="btn" style="margin-top:14px;" onclick="registerPlayer()">Register Player</button>
    </div>

    <div class="card">
      <h2>Roster (${state.players.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Age Group</th><th>Uniform</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${state.players.map(p => `
            <tr>
              <td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td>
              <td>${escapeHtml(p.age_group_name || '—')}</td>
              <td>${p.uniform_id ? `<span class="uniform-chip" style="background:${colorHex(p.uniform_color)};">${escapeHtml(p.uniform_color)} #${p.uniform_number}</span>` : '<span class="muted">none</span>'}</td>
              <td>${p.checked_in ? '<span class="badge available">Checked In</span>' : '<span class="badge lost">Not Checked In</span>'}</td>
              <td class="row">
                ${!p.checked_in ? `<button class="btn secondary small" onclick="openAssignUniform(${p.id})">Assign Uniform</button>` : `<button class="btn danger small" onclick="checkOutPlayer(${p.id})">Check Out</button>`}
                <button class="btn danger small" onclick="deletePlayer(${p.id})">Delete</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="muted">No players registered yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div id="assignModal"></div>
  `;
}

async function registerPlayer() {
  const first_name = document.getElementById('pFirst').value.trim();
  const last_name = document.getElementById('pLast').value.trim();
  const age_group_id = document.getElementById('pAgeGroup').value || null;
  const guardian_name = document.getElementById('pGuardianName').value.trim();
  const guardian_phone = document.getElementById('pGuardianPhone').value.trim();
  const guardian_email = document.getElementById('pGuardianEmail').value.trim();
  if (!first_name || !last_name) return alert('First and last name are required');
  await API.post(`/sessions/${state.currentSessionId}/players`, { first_name, last_name, age_group_id, guardian_name, guardian_phone, guardian_email });
  await loadSessionData();
  showTab('checkin');
}

function openAssignUniform(playerId) {
  const available = state.uniforms.filter(u => u.status === 'available');
  const modal = document.getElementById('assignModal');
  modal.innerHTML = `
    <div class="card" style="border-color:var(--green);">
      <h2>Assign Uniform</h2>
      ${available.length === 0 ? '<p class="muted">No available uniforms. Add more in the Uniforms tab.</p>' : `
        <select id="assignUniformSelect" style="max-width:260px;">
          ${available.sort((a,b)=> a.color.localeCompare(b.color) || a.number-b.number).map(u => `<option value="${u.id}">${escapeHtml(u.color)} #${u.number}</option>`).join('')}
        </select>
        <div class="row" style="margin-top:12px;">
          <button class="btn" onclick="confirmAssignUniform(${playerId})">Confirm Check-In</button>
          <button class="btn secondary" onclick="document.getElementById('assignModal').innerHTML=''">Cancel</button>
        </div>
      `}
    </div>
  `;
}

async function confirmAssignUniform(playerId) {
  const uniform_id = Number(document.getElementById('assignUniformSelect').value);
  try {
    await API.post(`/players/${playerId}/check-in`, { uniform_id });
    document.getElementById('assignModal').innerHTML = '';
    await loadSessionData();
    showTab('checkin');
  } catch (e) {
    alert(e.message);
  }
}

async function checkOutPlayer(playerId) {
  if (!confirm('Check out this player and free up their uniform?')) return;
  await API.post(`/players/${playerId}/check-out`);
  await loadSessionData();
  showTab('checkin');
}

async function deletePlayer(playerId) {
  if (!confirm('Delete this player permanently?')) return;
  await API.del(`/players/${playerId}`);
  await loadSessionData();
  showTab('checkin');
}

// ================= COACHES TAB =================
async function renderCoaches() {
  const el = document.getElementById('tab-coaches');
  state.coaches = await API.get('/coaches');
  const assignments = {};
  for (const c of state.coaches) {
    assignments[c.id] = await API.get(`/coaches/${c.id}/age-groups`);
  }

  el.innerHTML = `
    <div class="card">
      <h2>Add Coach</h2>
      <div class="row">
        <input type="text" id="coachName" placeholder="Coach name" style="max-width:200px;">
        <input type="text" id="coachPin" placeholder="4-digit PIN" maxlength="4" style="max-width:120px;">
        <button class="btn" onclick="addCoach()">Add Coach</button>
      </div>
    </div>

    <div class="card">
      <h2>Coaches ${state.currentSessionId ? '' : '<span class="muted">(select a session to assign age groups)</span>'}</h2>
      <table>
        <thead><tr><th>Name</th><th>PIN</th><th>Assigned Age Groups</th><th></th></tr></thead>
        <tbody>
          ${state.coaches.map(c => `
            <tr>
              <td>${escapeHtml(c.name)}</td>
              <td>${escapeHtml(c.pin || '—')}</td>
              <td>
                ${state.currentSessionId ? state.ageGroups.map(g => {
                  const assigned = assignments[c.id].some(a => a.id === g.id);
                  return `<label style="display:inline-block; margin-right:10px; font-size:13px;">
                    <input type="checkbox" ${assigned ? 'checked' : ''} onchange="toggleCoachAgeGroup(${c.id}, ${g.id}, this.checked)"> ${escapeHtml(g.name)}
                  </label>`;
                }).join('') : (assignments[c.id].map(a => `${escapeHtml(a.session_name)}: ${escapeHtml(a.name)}`).join(', ') || '<span class="muted">none</span>')}
              </td>
              <td><button class="btn danger small" onclick="deleteCoach(${c.id})">Delete</button></td>
            </tr>
          `).join('') || '<tr><td colspan="4" class="muted">No coaches yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

async function addCoach() {
  const name = document.getElementById('coachName').value.trim();
  const pin = document.getElementById('coachPin').value.trim();
  if (!name || !pin) return alert('Name and PIN are required');
  await API.post('/coaches', { name, pin });
  showTab('coaches');
}

async function toggleCoachAgeGroup(coachId, ageGroupId, checked) {
  if (checked) await API.post(`/coaches/${coachId}/age-groups/${ageGroupId}`);
  else await API.del(`/coaches/${coachId}/age-groups/${ageGroupId}`);
  showTab('coaches');
}

async function deleteCoach(id) {
  if (!confirm('Delete this coach and their evaluations?')) return;
  await API.del(`/coaches/${id}`);
  showTab('coaches');
}

// ================= REPORTS TAB =================
async function renderReports() {
  const el = document.getElementById('tab-reports');
  if (!state.currentSessionId) { el.innerHTML = '<div class="card muted">Create/select a session first.</div>'; return; }
  if (!state.ageGroups.length) { el.innerHTML = '<div class="card muted">Add an age group first.</div>'; return; }

  const selectedGroupId = state._reportGroupId || state.ageGroups[0].id;
  state._reportGroupId = selectedGroupId;

  const leaderboard = await API.get(`/sessions/${state.currentSessionId}/age-groups/${selectedGroupId}/leaderboard`);

  el.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <label>Age Group</label>
          <select onchange="changeReportGroup(this.value)">
            ${state.ageGroups.map(g => `<option value="${g.id}" ${g.id === selectedGroupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <button class="btn secondary" onclick="exportCsv(${selectedGroupId})">Export CSV</button>
      </div>
      <table style="margin-top:14px;">
        <thead><tr><th>#</th><th>Player</th><th>Uniform</th><th>Avg Total</th><th># Evals</th><th>Recommendations</th></tr></thead>
        <tbody>
          ${leaderboard.map((p, i) => `
            <tr style="cursor:pointer;" onclick="openPlayerDetail(${p.player_id})">
              <td>${i + 1}</td>
              <td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td>
              <td>${p.uniform_color ? `<span class="uniform-chip" style="background:${colorHex(p.uniform_color)};">${escapeHtml(p.uniform_color)} #${p.uniform_number}</span>` : '—'}</td>
              <td><strong>${p.average_total != null ? Number(p.average_total).toFixed(1) : '—'}</strong></td>
              <td>${p.eval_count}</td>
              <td>${escapeHtml(p.recommendations || '—')}</td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="muted">No players in this age group yet</td></tr>'}
        </tbody>
      </table>
    </div>
    <div id="playerDetailModal"></div>
  `;
}

function changeReportGroup(id) {
  state._reportGroupId = Number(id);
  showTab('reports');
}

async function openPlayerDetail(playerId) {
  const data = await API.get(`/players/${playerId}/evaluations`);
  const modal = document.getElementById('playerDetailModal');
  modal.innerHTML = `
    <div class="card" style="border-color:var(--green);">
      <h2>Evaluation Detail ${data.average_total != null ? `— Avg: ${Number(data.average_total).toFixed(1)}/100` : ''}</h2>
      <table>
        <thead><tr><th>Coach</th><th>Ball Hdl</th><th>Shoot</th><th>Def</th><th>IQ</th><th>Athl</th><th>Coach-ability</th><th>Total</th><th>Rec</th><th>Notes</th></tr></thead>
        <tbody>
          ${data.evaluations.map(e => `
            <tr>
              <td>${escapeHtml(e.coach_name)}</td>
              <td>${e.ball_handling}/25</td>
              <td>${e.shooting}/25</td>
              <td>${e.defense}/20</td>
              <td>${e.basketball_iq}/15</td>
              <td>${e.athleticism}/10</td>
              <td>${e.coachability}/5</td>
              <td><strong>${e.total}</strong></td>
              <td>${escapeHtml(e.recommendation || '—')}</td>
              <td>${escapeHtml(e.notes || '')}</td>
            </tr>
          `).join('') || '<tr><td colspan="10" class="muted">No evaluations submitted yet</td></tr>'}
        </tbody>
      </table>
      <button class="btn secondary" style="margin-top:12px;" onclick="document.getElementById('playerDetailModal').innerHTML=''">Close</button>
    </div>
  `;
}

async function exportCsv(ageGroupId) {
  const leaderboard = await API.get(`/sessions/${state.currentSessionId}/age-groups/${ageGroupId}/leaderboard`);
  const rows = [['Player', 'Uniform', 'Avg Total', '# Evals', 'Recommendations']];
  leaderboard.forEach(p => rows.push([
    `${p.first_name} ${p.last_name}`,
    p.uniform_color ? `${p.uniform_color} #${p.uniform_number}` : '',
    p.average_total != null ? Number(p.average_total).toFixed(1) : '',
    p.eval_count,
    p.recommendations || ''
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const groupName = state.ageGroups.find(g => g.id === ageGroupId)?.name || 'group';
  link.download = `tryout-results-${groupName}.csv`;
  link.click();
}

// ---------- Init ----------
loadAuth();
if (state.admin) boot();
