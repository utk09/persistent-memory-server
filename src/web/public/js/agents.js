let selectedIds = new Set();

const searchInput = document.getElementById("search-input");
const tagFilter = document.getElementById("tag-filter");

searchInput.addEventListener("input", debounce(loadAgents));
tagFilter.addEventListener("input", debounce(loadAgents));

async function loadAgents() {
  const params = {};
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    const agents = await api.agents.list(params);
    renderAgents(agents);
  } catch (err) {
    console.error("Failed to load agents:", err);
  }
}

function renderAgents(agents) {
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
    <div class="card" style="display: flex; gap: 12px; align-items: flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" onchange="toggleSelect('${a.id}', this.checked)" onclick="event.stopPropagation()" />
      <div style="flex: 1" onclick="viewAgent('${a.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(a.name)}</span>
          <span class="badge badge-${a.permission}">${a.permission}</span>
        </div>
        <div class="card-content">${escapeHtml(truncate(a.description))}</div>
        ${a.tools.length > 0 ? `<div class="card-meta" style="margin-top: 4px">Tools: ${a.tools.map((t) => escapeHtml(t)).join(", ")}</div>` : ""}
        <div class="tags">${renderTags(a.tags)}</div>
        <div class="card-meta" style="margin-top: 4px">${formatDate(a.updatedAt)}</div>
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
    selectedIds.clear();
    await loadAgents();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function viewAgent(id) {
  try {
    const a = await api.agents.get(id);
    document.getElementById("view-title").textContent = a.name;
    document.getElementById("view-meta").innerHTML = `
      <span class="badge badge-${a.permission}">${a.permission}</span>
      ${a.permissionExpiresAt ? ` &middot; Expires: ${formatDate(a.permissionExpiresAt)}` : ""}
      &middot; ${formatDate(a.updatedAt)}
    `;
    document.getElementById("view-description").textContent = a.description;
    document.getElementById("view-prompt").innerHTML = marked.parse(a.systemPrompt);
    document.getElementById("view-tools").innerHTML =
      a.tools.length > 0
        ? `<label>Tools</label><div class="tags">${a.tools.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`
        : "";
    document.getElementById("view-tags").innerHTML = renderTags(a.tags);
    document.getElementById("view-edit-btn").onclick = () => {
      closeViewModal();
      openEditModal(a);
    };
    document.getElementById("view-overlay").style.display = "flex";
  } catch (err) {
    alert("Failed to load agent: " + err.message);
  }
}

function closeViewModal() {
  document.getElementById("view-overlay").style.display = "none";
}

function openCreateModal() {
  document.getElementById("modal-title").textContent = "New Agent";
  document.getElementById("submit-btn").textContent = "Create";
  document.getElementById("delete-btn").style.display = "none";
  document.getElementById("form-id").value = "";
  document.getElementById("agent-form").reset();
  document.getElementById("modal-overlay").style.display = "flex";
}

function openEditModal(a) {
  document.getElementById("modal-title").textContent = "Edit Agent";
  document.getElementById("submit-btn").textContent = "Save";
  document.getElementById("delete-btn").style.display = "inline-flex";
  document.getElementById("form-id").value = a.id;
  document.getElementById("form-name").value = a.name;
  document.getElementById("form-description").value = a.description;
  document.getElementById("form-system-prompt").value = a.systemPrompt;
  document.getElementById("form-tools").value = a.tools.join(", ");
  document.getElementById("form-permission").value = a.permission;
  if (a.permissionExpiresAt) {
    document.getElementById("form-permission-expires").value = a.permissionExpiresAt.slice(0, 16);
  }
  document.getElementById("form-tags").value = a.tags.join(", ");
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

async function handleSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("form-id").value;

  const tags = document
    .getElementById("form-tags")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const tools = document
    .getElementById("form-tools")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const permExpiresInput = document.getElementById("form-permission-expires").value;

  const data = {
    name: document.getElementById("form-name").value,
    description: document.getElementById("form-description").value,
    systemPrompt: document.getElementById("form-system-prompt").value,
    tools,
    permission: document.getElementById("form-permission").value,
    permissionExpiresAt: permExpiresInput ? new Date(permExpiresInput).toISOString() : undefined,
    tags,
  };

  try {
    if (id) {
      await api.agents.update(id, data);
    } else {
      await api.agents.create(data);
    }
    closeModal();
    await loadAgents();
  } catch (err) {
    alert("Failed to save agent: " + err.message);
  }
}

async function handleDelete() {
  const id = document.getElementById("form-id").value;
  if (!id || !confirm("Delete this agent?")) return;
  try {
    await api.agents.delete(id);
    closeModal();
    await loadAgents();
  } catch (err) {
    alert("Failed to delete agent: " + err.message);
  }
}

setupModalClose("modal-overlay", closeModal);
setupModalClose("view-overlay", closeViewModal);

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.agents.get(editId).then(openEditModal).catch(console.error);
}

loadAgents();
