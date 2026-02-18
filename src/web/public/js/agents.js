let currentAgentId = null;
let currentDetailAgent = null;
let isDirty = false;
let currentAgents = [];
const selectedIds = new Set();

const searchInput = document.getElementById("search-input");
const tagFilter = document.getElementById("tag-filter");

searchInput.addEventListener("input", debounce(loadAgents));
tagFilter.addEventListener("input", debounce(loadAgents));

function confirmLeave() {
  if (!isDirty) return true;
  return confirm("You have unsaved changes. Leave anyway?");
}

async function loadAgents() {
  const params = {};
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    currentAgents = await api.agents.list(params);
    renderList(currentAgents);
  } catch (err) {
    console.error("Failed to load agents:", err);
  }
}

function renderList(agents) {
  const list = document.getElementById("agent-list");
  selectedIds.clear();
  updateBulkBar();

  if (agents.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No agents found.</p></div>`;
    return;
  }

  list.innerHTML = agents
    .map(
      (a) => `
    <div class="card ${a.id === currentAgentId ? "active" : ""}" style="display:flex;gap:10px;align-items:flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" onchange="toggleSelect('${a.id}',this.checked)" onclick="event.stopPropagation()" />
      <div style="flex:1;cursor:pointer" onclick="navigateAgent('${a.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(a.name)}</span>
          <span class="badge badge-${a.permission}">${a.permission}</span>
        </div>
        <div class="card-content">${escapeHtml(truncate(a.description))}</div>
        <div class="tags" style="margin-top:6px">${renderTags(a.tags)}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function toggleSelect(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById("bulk-bar");
  const count = document.getElementById("bulk-count");
  if (selectedIds.size > 0) {
    bar.classList.add("visible");
    count.textContent = `${selectedIds.size} selected`;
  } else {
    bar.classList.remove("visible");
  }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedIds.size} agents?`)) return;
  try {
    await api.bulkDelete("agent", [...selectedIds]);
    if (selectedIds.has(currentAgentId)) {
      currentAgentId = null;
      currentDetailAgent = null;
      showEmptyPanel();
    }
    selectedIds.clear();
    await loadAgents();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function navigateAgent(id) {
  if (id === currentAgentId) return;
  if (!confirmLeave()) return;
  try {
    const a = await api.agents.get(id);
    currentAgentId = id;
    currentDetailAgent = a;
    isDirty = false;
    renderList(currentAgents);
    showDetailPanel(a);
  } catch (err) {
    alert("Failed to load agent: " + err.message);
  }
}

function showEmptyPanel() {
  document.getElementById("detail-panel").innerHTML = `
    <div class="panel-empty"><p>Select an agent or create a new one</p></div>
  `;
}

function showDetailPanel(a) {
  currentDetailAgent = a;
  const modelPill = a.model
    ? `<span class="badge" style="background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border)">${escapeHtml(a.model)}</span>`
    : "";
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">
        <h2 style="min-width:0;word-break:break-word">${escapeHtml(a.name)}</h2>
        <span class="badge badge-${a.permission}">${a.permission}</span>
        ${modelPill}
      </div>
      <button class="btn btn-primary" style="flex-shrink:0" onclick="openEditPanel()">Edit</button>
    </div>
    <div class="panel-body">
      <p style="color:var(--text-secondary);margin-bottom:16px">${escapeHtml(a.description)}</p>
      ${a.permissionExpiresAt ? `<p class="card-meta" style="margin-bottom:12px">Permission expires: ${formatDate(a.permissionExpiresAt)}</p>` : ""}
      <label>System Prompt</label>
      <div class="markdown-content" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-top:4px;margin-bottom:16px">${marked.parse(a.systemPrompt)}</div>
      ${
        a.tools && a.tools.length > 0
          ? `<div style="margin-bottom:12px">
               <label style="margin-bottom:6px">Tools</label>
               <div class="tags">${a.tools.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
             </div>`
          : ""
      }
      ${
        a.tags && a.tags.length > 0
          ? `<div style="margin-bottom:12px">
               <label style="margin-bottom:6px">Tags</label>
               <div class="tags">${renderTags(a.tags)}</div>
             </div>`
          : ""
      }
      <div class="card-meta" style="margin-top:16px">${formatDate(a.updatedAt)}</div>
    </div>
  `;
}

function showFormPanel(agent) {
  const isEdit = !!agent;
  isDirty = false;
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <h2>${isEdit ? "Edit Agent" : "New Agent"}</h2>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn" onclick="handleFormCancel()">Cancel</button>
        ${isEdit ? `<button class="btn btn-danger" onclick="handleDelete()">Delete</button>` : ""}
        <button class="btn btn-primary" onclick="handleFormSubmit()">${isEdit ? "Save" : "Create"}</button>
      </div>
    </div>
    <div class="panel-body">
      <input type="hidden" id="form-id" />
      <div class="form-group">
        <label for="form-name">Name</label>
        <input type="text" id="form-name" required placeholder="e.g. Code Reviewer" />
      </div>
      <div class="form-group">
        <label for="form-description">Description</label>
        <input type="text" id="form-description" required placeholder="Short description of what this agent does" />
      </div>
      <div class="form-group">
        <label for="form-system-prompt">System Prompt</label>
        <textarea id="form-system-prompt" rows="10" required></textarea>
      </div>
      <div class="form-group">
        <label>Tools</label>
        <div id="form-tools-picker" class="tool-picker"><span class="card-meta">Loading tools…</span></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="form-model">Model (optional)</label>
          <input type="text" id="form-model" placeholder="e.g. claude-sonnet-4-6" />
        </div>
        <div class="form-group">
          <label for="form-permission">Permission</label>
          <select id="form-permission">
            <option value="read-only">Read Only</option>
            <option value="read-write">Read Write</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="form-permission-expires">Permission Expires (optional)</label>
        <input type="datetime-local" id="form-permission-expires" />
      </div>
      <div class="form-group">
        <label for="form-tags">Tags (comma-separated)</label>
        <input type="text" id="form-tags" placeholder="e.g. helper, review" />
      </div>
    </div>
  `;

  if (isEdit) {
    document.getElementById("form-id").value = agent.id;
    document.getElementById("form-name").value = agent.name;
    document.getElementById("form-description").value = agent.description;
    document.getElementById("form-system-prompt").value = agent.systemPrompt;
    // tools are checked after picker loads (see below)
    document.getElementById("form-model").value = agent.model || "";
    document.getElementById("form-permission").value = agent.permission;
    if (agent.permissionExpiresAt) {
      document.getElementById("form-permission-expires").value = agent.permissionExpiresAt.slice(
        0,
        16,
      );
    }
    document.getElementById("form-tags").value = agent.tags.join(", ");
  }

  panel.querySelectorAll("input, textarea, select").forEach(function (el) {
    el.addEventListener("input", function () {
      isDirty = true;
    });
    el.addEventListener("change", function () {
      isDirty = true;
    });
  });

  // Load tool picker
  loadToolPicker(isEdit ? agent.tools : []);
}

async function loadToolPicker(selectedTools) {
  const picker = document.getElementById("form-tools-picker");
  if (!picker) return;
  try {
    const tools = await api.tools();
    const groups = {};
    tools.forEach(function (t) {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push(t);
    });
    let html = "";
    Object.keys(groups).forEach(function (group) {
      html += '<div class="tool-group">';
      html += '<div class="tool-group-header">' + escapeHtml(group) + "</div>";
      html += '<div class="tool-group-items">';
      groups[group].forEach(function (t) {
        const checked = selectedTools.indexOf(t.name) !== -1 ? "checked" : "";
        html += '<label class="tool-option" title="' + escapeHtml(t.description) + '">';
        html +=
          '<input type="checkbox" name="form-tool" value="' +
          escapeHtml(t.name) +
          '" ' +
          checked +
          " />";
        html += "<span>" + escapeHtml(t.name) + "</span>";
        html += "</label>";
      });
      html += "</div></div>";
    });
    picker.innerHTML = html;
    picker.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        isDirty = true;
      });
    });
  } catch (err) {
    picker.innerHTML = '<span class="card-meta">Failed to load tools</span>';
    console.error("Failed to load tools:", err);
  }
}

function openEditPanel() {
  showFormPanel(currentDetailAgent);
}

function openCreatePanel() {
  if (!confirmLeave()) return;
  isDirty = false;
  currentAgentId = null;
  currentDetailAgent = null;
  renderList(currentAgents);
  showFormPanel(null);
}

function handleFormCancel() {
  if (!confirmLeave()) return;
  isDirty = false;
  if (currentDetailAgent) {
    showDetailPanel(currentDetailAgent);
  } else {
    showEmptyPanel();
  }
}

async function handleFormSubmit() {
  const nameEl = document.getElementById("form-name");
  const descEl = document.getElementById("form-description");
  const promptEl = document.getElementById("form-system-prompt");

  if (!nameEl.value.trim() || !descEl.value.trim() || !promptEl.value.trim()) {
    alert("Name, description, and system prompt are required.");
    return;
  }

  const id = document.getElementById("form-id").value;
  const tags = document
    .getElementById("form-tags")
    .value.split(",")
    .map(function (t) {
      return t.trim();
    })
    .filter(Boolean);
  const tools = Array.from(
    document.querySelectorAll('#form-tools-picker input[name="form-tool"]:checked'),
  ).map(function (cb) {
    return cb.value;
  });
  const permExpires = document.getElementById("form-permission-expires").value;
  const model = document.getElementById("form-model").value.trim();

  const data = {
    name: nameEl.value.trim(),
    description: descEl.value.trim(),
    systemPrompt: promptEl.value,
    tools: tools,
    model: model || undefined,
    permission: document.getElementById("form-permission").value,
    permissionExpiresAt: permExpires ? new Date(permExpires).toISOString() : undefined,
    tags: tags,
  };

  try {
    let saved;
    if (id) {
      saved = await api.agents.update(id, data);
    } else {
      saved = await api.agents.create(data);
    }
    isDirty = false;
    currentAgentId = saved.id;
    currentDetailAgent = saved;
    await loadAgents();
    showDetailPanel(saved);
  } catch (err) {
    alert("Failed to save agent: " + err.message);
  }
}

async function handleDelete() {
  if (!currentDetailAgent || !confirm("Delete this agent?")) return;
  try {
    await api.agents.delete(currentDetailAgent.id);
    isDirty = false;
    currentAgentId = null;
    currentDetailAgent = null;
    await loadAgents();
    showEmptyPanel();
  } catch (err) {
    alert("Failed to delete agent: " + err.message);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.agents
    .get(editId)
    .then(function (a) {
      currentAgentId = a.id;
      currentDetailAgent = a;
      showFormPanel(a);
    })
    .catch(console.error);
}

loadAgents().then(function () {
  if (!editId) showEmptyPanel();
});
