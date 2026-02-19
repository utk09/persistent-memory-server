let currentSessionId = null;
let currentSessions = [];

const userFilter = document.getElementById("user-filter");
const deviceFilter = document.getElementById("device-filter");
const activeFilter = document.getElementById("active-filter");

userFilter.addEventListener("input", debounce(loadSessions));
deviceFilter.addEventListener("input", debounce(loadSessions));
activeFilter.addEventListener("change", loadSessions);

async function loadSessions() {
  const params = {};
  if (userFilter.value.trim()) params.user = userFilter.value.trim();
  if (deviceFilter.value.trim()) params.device = deviceFilter.value.trim();
  if (activeFilter.value) params.active = activeFilter.value === "true";

  try {
    currentSessions = await api.sessions.list(params);
    renderList(currentSessions);
  } catch (err) {
    clientLog.error("sessions", "Failed to load sessions: " + err.message);
  }
}

function sessionStatus(session) {
  if (!session.closedAt) return "active";
  return "closed";
}

function renderList(sessions) {
  const list = document.getElementById("session-list");

  if (sessions.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No sessions found.</p></div>`;
    return;
  }

  list.innerHTML = sessions
    .map(
      (s) => `
    <div class="card ${s.id === currentSessionId ? "active" : ""}" style="cursor:pointer" onclick="viewSession('${s.id}')">
      <div class="card-header">
        <span class="card-title">${escapeHtml(s.user)}@${escapeHtml(s.device)}</span>
        <span class="badge badge-${sessionStatus(s) === "active" ? "global" : "file"}">${sessionStatus(s)}</span>
      </div>
      <div class="card-meta">${escapeHtml(s.transport)} · ${formatDate(s.createdAt)}</div>
      ${s.ipAddress ? `<div class="card-meta">IP: ${escapeHtml(s.ipAddress)}</div>` : ""}
    </div>
  `,
    )
    .join("");
}

async function viewSession(id) {
  if (id === currentSessionId) return;
  clientLog.info("sessions", "View session " + id);
  try {
    const s = await api.sessions.get(id);
    currentSessionId = id;
    renderList(currentSessions);
    showDetailPanel(s);
  } catch (err) {
    alert("Failed to load session: " + err.message);
  }
}

function showDetailPanel(s) {
  const status = sessionStatus(s);
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <h2 style="min-width:0;word-break:break-word">${escapeHtml(s.user)}@${escapeHtml(s.device)}</h2>
      <span class="badge badge-${status === "active" ? "global" : "file"}">${status}</span>
    </div>
    <div class="panel-body">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
        <tbody>
          <tr><td style="padding:6px 0;color:var(--text-secondary);width:130px">Internal ID</td><td style="padding:6px 0;word-break:break-all">${escapeHtml(s.id)}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-secondary)">Session ID</td><td style="padding:6px 0;word-break:break-all">${escapeHtml(s.sessionId)}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-secondary)">User</td><td style="padding:6px 0">${escapeHtml(s.user)}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-secondary)">Device</td><td style="padding:6px 0">${escapeHtml(s.device)}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-secondary)">Transport</td><td style="padding:6px 0">${escapeHtml(s.transport)}</td></tr>
          ${s.ipAddress ? `<tr><td style="padding:6px 0;color:var(--text-secondary)">IP Address</td><td style="padding:6px 0">${escapeHtml(s.ipAddress)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:var(--text-secondary)">Created</td><td style="padding:6px 0">${formatDate(s.createdAt)}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-secondary)">Last Active</td><td style="padding:6px 0">${formatDate(s.updatedAt)}</td></tr>
          ${s.closedAt ? `<tr><td style="padding:6px 0;color:var(--text-secondary)">Closed</td><td style="padding:6px 0">${formatDate(s.closedAt)}</td></tr>` : ""}
        </tbody>
      </table>
    </div>
  `;
}

loadSessions();
