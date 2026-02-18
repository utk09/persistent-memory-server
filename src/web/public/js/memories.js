let currentScope = "";
let currentMemoryId = null;
let currentDetailMemory = null;
let isDirty = false;
let currentMemories = [];
const selectedIds = new Set();

// Scope tabs
document.querySelectorAll("#scope-tabs .tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll("#scope-tabs .tab").forEach(function (t) {
      t.classList.remove("active");
    });
    tab.classList.add("active");
    currentScope = tab.dataset.scope;
    loadMemories();
  });
});

const searchInput = document.getElementById("search-input");
const tagFilter = document.getElementById("tag-filter");

searchInput.addEventListener("input", debounce(loadMemories));
tagFilter.addEventListener("input", debounce(loadMemories));

function confirmLeave() {
  if (!isDirty) return true;
  return confirm("You have unsaved changes. Leave anyway?");
}

async function loadMemories() {
  const params = {};
  if (currentScope) params.scope = currentScope;
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    currentMemories = await api.memories.list(params);
    renderList(currentMemories);
  } catch (err) {
    console.error("Failed to load memories:", err);
  }
}

function renderList(memories) {
  const list = document.getElementById("memory-list");
  selectedIds.clear();
  updateBulkBar();

  if (memories.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No memories found.</p></div>`;
    return;
  }

  list.innerHTML = memories
    .map(
      (m) => `
    <div class="card ${m.id === currentMemoryId ? "active" : ""}" style="display:flex;gap:10px;align-items:flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${m.id}" onchange="toggleSelect('${m.id}',this.checked)" onclick="event.stopPropagation()" />
      <div style="flex:1;cursor:pointer" onclick="navigateMemory('${m.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(m.title)}</span>
          <span class="badge badge-${m.scope}">${m.scope}</span>
        </div>
        ${m.projectPath ? `<div class="card-meta">${escapeHtml(m.projectPath)}${m.filePath ? ` / ${escapeHtml(m.filePath)}` : ""}</div>` : ""}
        <div class="card-content">${escapeHtml(truncate(m.content))}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <div class="tags">${renderTags(m.tags)}</div>
          ${isExpiringSoon(m.expiresAt) ? `<span class="expiry-warning">Expires ${formatDate(m.expiresAt)}</span>` : ""}
        </div>
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
  if (!confirm(`Delete ${selectedIds.size} memories?`)) return;
  try {
    await api.bulkDelete("memory", [...selectedIds]);
    if (selectedIds.has(currentMemoryId)) {
      currentMemoryId = null;
      currentDetailMemory = null;
      showEmptyPanel();
    }
    selectedIds.clear();
    await loadMemories();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function navigateMemory(id) {
  if (id === currentMemoryId) return;
  if (!confirmLeave()) return;
  try {
    const m = await api.memories.get(id);
    currentMemoryId = id;
    currentDetailMemory = m;
    isDirty = false;
    renderList(currentMemories);
    showDetailPanel(m);
  } catch (err) {
    alert("Failed to load memory: " + err.message);
  }
}

function showEmptyPanel() {
  document.getElementById("detail-panel").innerHTML = `
    <div class="panel-empty"><p>Select a memory or create a new one</p></div>
  `;
}

function showDetailPanel(m) {
  currentDetailMemory = m;
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <h2 style="min-width:0;word-break:break-word">${escapeHtml(m.title)}</h2>
      <button class="btn btn-primary" style="flex-shrink:0" onclick="openEditPanel()">Edit</button>
    </div>
    <div class="panel-body">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge badge-${m.scope}">${m.scope}</span>
        ${m.projectPath ? `<span class="card-meta">${escapeHtml(m.projectPath)}${m.filePath ? ` / ${escapeHtml(m.filePath)}` : ""}</span>` : ""}
        <span class="card-meta">${formatDate(m.updatedAt)}</span>
        ${m.expiresAt ? `<span class="expiry-warning">Expires ${formatDate(m.expiresAt)}</span>` : ""}
      </div>
      <div class="markdown-content">${marked.parse(m.content)}</div>
      ${m.tags && m.tags.length > 0 ? `<div class="tags" style="margin-top:12px">${renderTags(m.tags)}</div>` : ""}
    </div>
  `;
}

function showFormPanel(memory) {
  const isEdit = !!memory;
  isDirty = false;
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <h2>${isEdit ? "Edit Memory" : "New Memory"}</h2>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn" onclick="handleFormCancel()">Cancel</button>
        ${isEdit ? `<button class="btn btn-danger" onclick="handleDelete()">Delete</button>` : ""}
        <button class="btn btn-primary" onclick="handleFormSubmit()">${isEdit ? "Save" : "Create"}</button>
      </div>
    </div>
    <div class="panel-body">
      <input type="hidden" id="form-id" />
      <div class="form-group">
        <label for="form-title">Title</label>
        <input type="text" id="form-title" required />
      </div>
      <div class="form-group">
        <label for="form-content">Content (Markdown supported)</label>
        <textarea id="form-content" rows="8" required></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="form-scope">Scope</label>
          <select id="form-scope" onchange="handleScopeChange()">
            <option value="global">Global</option>
            <option value="project">Project</option>
            <option value="file">File</option>
          </select>
        </div>
        <div class="form-group">
          <label for="form-tags">Tags (comma-separated)</label>
          <input type="text" id="form-tags" placeholder="e.g. style, config" />
        </div>
      </div>
      <div class="form-group" id="project-path-group" style="display:none">
        <label for="form-project-path">Project Path</label>
        <input type="text" id="form-project-path" placeholder="/absolute/path/to/project" />
      </div>
      <div class="form-group" id="file-path-group" style="display:none">
        <label for="form-file-path">File Path (relative to project)</label>
        <input type="text" id="form-file-path" placeholder="src/index.ts" />
      </div>
      <div class="form-group">
        <label for="form-expires">Expires At (optional)</label>
        <input type="datetime-local" id="form-expires" />
      </div>
    </div>
  `;

  if (isEdit) {
    document.getElementById("form-id").value = memory.id;
    document.getElementById("form-title").value = memory.title;
    document.getElementById("form-content").value = memory.content;
    document.getElementById("form-scope").value = memory.scope;
    document.getElementById("form-tags").value = memory.tags.join(", ");
    document.getElementById("form-project-path").value = memory.projectPath || "";
    document.getElementById("form-file-path").value = memory.filePath || "";
    if (memory.expiresAt) {
      document.getElementById("form-expires").value = memory.expiresAt.slice(0, 16);
    }
  } else {
    document.getElementById("form-scope").value = currentScope || "global";
  }

  handleScopeChange();

  panel.querySelectorAll("input, textarea, select").forEach(function (el) {
    el.addEventListener("input", function () {
      isDirty = true;
    });
    el.addEventListener("change", function () {
      isDirty = true;
    });
  });
}

function handleScopeChange() {
  const scope = document.getElementById("form-scope").value;
  const ppg = document.getElementById("project-path-group");
  const fpg = document.getElementById("file-path-group");
  if (ppg) ppg.style.display = scope === "project" || scope === "file" ? "block" : "none";
  if (fpg) fpg.style.display = scope === "file" ? "block" : "none";
}

function openEditPanel() {
  showFormPanel(currentDetailMemory);
}

function openCreatePanel() {
  if (!confirmLeave()) return;
  isDirty = false;
  currentMemoryId = null;
  currentDetailMemory = null;
  renderList(currentMemories);
  showFormPanel(null);
}

function handleFormCancel() {
  if (!confirmLeave()) return;
  isDirty = false;
  if (currentDetailMemory) {
    showDetailPanel(currentDetailMemory);
  } else {
    showEmptyPanel();
  }
}

async function handleFormSubmit() {
  const titleEl = document.getElementById("form-title");
  const contentEl = document.getElementById("form-content");

  if (!titleEl.value.trim() || !contentEl.value.trim()) {
    alert("Title and content are required.");
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
  const expiresInput = document.getElementById("form-expires").value;

  const data = {
    title: titleEl.value.trim(),
    content: contentEl.value,
    scope: document.getElementById("form-scope").value,
    tags: tags,
    projectPath: document.getElementById("form-project-path").value || undefined,
    filePath: document.getElementById("form-file-path").value || undefined,
    expiresAt: expiresInput ? new Date(expiresInput).toISOString() : undefined,
  };

  try {
    let saved;
    if (id) {
      saved = await api.memories.update(id, data);
    } else {
      saved = await api.memories.create(data);
    }
    isDirty = false;
    currentMemoryId = saved.id;
    currentDetailMemory = saved;
    await loadMemories();
    showDetailPanel(saved);
  } catch (err) {
    alert("Failed to save memory: " + err.message);
  }
}

async function handleDelete() {
  if (!currentDetailMemory || !confirm("Delete this memory?")) return;
  try {
    await api.memories.delete(currentDetailMemory.id);
    isDirty = false;
    currentMemoryId = null;
    currentDetailMemory = null;
    await loadMemories();
    showEmptyPanel();
  } catch (err) {
    alert("Failed to delete memory: " + err.message);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.memories
    .get(editId)
    .then(function (m) {
      currentMemoryId = m.id;
      currentDetailMemory = m;
      showFormPanel(m);
    })
    .catch(console.error);
}

loadMemories().then(function () {
  if (!editId) showEmptyPanel();
});
