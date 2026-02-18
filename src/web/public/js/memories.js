let currentScope = "";
let selectedIds = new Set();

// Scope tabs
document.querySelectorAll("#scope-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#scope-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentScope = tab.dataset.scope;
    loadMemories();
  });
});

// Search with debounce
const searchInput = document.getElementById("search-input");
const tagFilter = document.getElementById("tag-filter");
searchInput.addEventListener("input", debounce(loadMemories));
tagFilter.addEventListener("input", debounce(loadMemories));

async function loadMemories() {
  const params = {};
  if (currentScope) params.scope = currentScope;
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    const memories = await api.memories.list(params);
    renderMemories(memories);
  } catch (err) {
    console.error("Failed to load memories:", err);
  }
}

function renderMemories(memories) {
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
    <div class="card" style="display: flex; gap: 12px; align-items: flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${m.id}" onchange="toggleSelect('${m.id}', this.checked)" onclick="event.stopPropagation()" />
      <div style="flex: 1" onclick="viewMemory('${m.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(m.title)}</span>
          <span class="badge badge-${m.scope}">${m.scope}</span>
        </div>
        ${m.projectPath ? `<div class="card-meta">${escapeHtml(m.projectPath)}${m.filePath ? ` / ${escapeHtml(m.filePath)}` : ""}</div>` : ""}
        <div class="card-content">${escapeHtml(truncate(m.content))}</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px">
          <div class="tags">${renderTags(m.tags)}</div>
          ${isExpiringSoon(m.expiresAt) ? `<span class="expiry-warning">Expires ${formatDate(m.expiresAt)}</span>` : ""}
        </div>
        <div class="card-meta" style="margin-top: 4px">${formatDate(m.updatedAt)}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function toggleSelect(id, checked) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
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
    selectedIds.clear();
    await loadMemories();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function viewMemory(id) {
  try {
    const m = await api.memories.get(id);
    document.getElementById("view-title").textContent = m.title;
    document.getElementById("view-meta").innerHTML = `
      <span class="badge badge-${m.scope}">${m.scope}</span>
      ${m.projectPath ? ` &middot; ${escapeHtml(m.projectPath)}` : ""}
      ${m.filePath ? ` / ${escapeHtml(m.filePath)}` : ""}
      &middot; ${formatDate(m.updatedAt)}
      ${m.expiresAt ? ` &middot; Expires: ${formatDate(m.expiresAt)}` : ""}
    `;
    document.getElementById("view-content").innerHTML = marked.parse(m.content);
    document.getElementById("view-tags").innerHTML = renderTags(m.tags);
    document.getElementById("view-edit-btn").onclick = () => {
      closeViewModal();
      openEditModal(m);
    };
    document.getElementById("view-overlay").style.display = "flex";
  } catch (err) {
    alert("Failed to load memory: " + err.message);
  }
}

function closeViewModal() {
  document.getElementById("view-overlay").style.display = "none";
}

function openCreateModal() {
  document.getElementById("modal-title").textContent = "New Memory";
  document.getElementById("submit-btn").textContent = "Create";
  document.getElementById("delete-btn").style.display = "none";
  document.getElementById("form-id").value = "";
  document.getElementById("memory-form").reset();
  document.getElementById("form-scope").value = "global";
  handleScopeChange();
  document.getElementById("modal-overlay").style.display = "flex";
}

function openEditModal(m) {
  document.getElementById("modal-title").textContent = "Edit Memory";
  document.getElementById("submit-btn").textContent = "Save";
  document.getElementById("delete-btn").style.display = "inline-flex";
  document.getElementById("form-id").value = m.id;
  document.getElementById("form-title").value = m.title;
  document.getElementById("form-content").value = m.content;
  document.getElementById("form-scope").value = m.scope;
  document.getElementById("form-tags").value = m.tags.join(", ");
  document.getElementById("form-project-path").value = m.projectPath || "";
  document.getElementById("form-file-path").value = m.filePath || "";
  if (m.expiresAt) {
    document.getElementById("form-expires").value = m.expiresAt.slice(0, 16);
  }
  handleScopeChange();
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

function handleScopeChange() {
  const scope = document.getElementById("form-scope").value;
  document.getElementById("project-path-group").style.display =
    scope === "project" || scope === "file" ? "block" : "none";
  document.getElementById("file-path-group").style.display = scope === "file" ? "block" : "none";
}

async function handleSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("form-id").value;
  const tags = document
    .getElementById("form-tags")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const expiresInput = document.getElementById("form-expires").value;
  const data = {
    title: document.getElementById("form-title").value,
    content: document.getElementById("form-content").value,
    scope: document.getElementById("form-scope").value,
    tags,
    projectPath: document.getElementById("form-project-path").value || undefined,
    filePath: document.getElementById("form-file-path").value || undefined,
    expiresAt: expiresInput ? new Date(expiresInput).toISOString() : undefined,
  };

  try {
    if (id) {
      await api.memories.update(id, data);
    } else {
      await api.memories.create(data);
    }
    closeModal();
    await loadMemories();
  } catch (err) {
    alert("Failed to save memory: " + err.message);
  }
}

async function handleDelete() {
  const id = document.getElementById("form-id").value;
  if (!id || !confirm("Delete this memory?")) return;
  try {
    await api.memories.delete(id);
    closeModal();
    await loadMemories();
  } catch (err) {
    alert("Failed to delete memory: " + err.message);
  }
}

// Setup modal close on overlay click
setupModalClose("modal-overlay", closeModal);
setupModalClose("view-overlay", closeViewModal);

// Handle ?edit=ID in URL
const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.memories.get(editId).then(openEditModal).catch(console.error);
}

loadMemories();
