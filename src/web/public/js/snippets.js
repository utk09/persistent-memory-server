let currentSnippetId = null;
let currentDetailSnippet = null;
let isDirty = false;
let currentSnippets = [];
const selectedIds = new Set();

const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const tagFilter = document.getElementById("tag-filter");

searchInput.addEventListener("input", debounce(loadSnippets));
typeFilter.addEventListener("change", loadSnippets);
tagFilter.addEventListener("input", debounce(loadSnippets));

function confirmLeave() {
  if (!isDirty) return true;
  return confirm("You have unsaved changes. Leave anyway?");
}

async function loadSnippets() {
  const params = {};
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (typeFilter.value) params.type = typeFilter.value;
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    currentSnippets = await api.snippets.list(params);
    renderList(currentSnippets);
  } catch (err) {
    console.error("Failed to load snippets:", err);
  }
}

function renderList(snippets) {
  const list = document.getElementById("snippet-list");
  selectedIds.clear();
  updateBulkBar();

  if (snippets.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No snippets found.</p></div>`;
    return;
  }

  list.innerHTML = snippets
    .map(
      (s) => `
    <div class="card ${s.id === currentSnippetId ? "active" : ""}" style="display:flex;gap:10px;align-items:flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${s.id}" onchange="toggleSelect('${s.id}',this.checked)" onclick="event.stopPropagation()" />
      <div style="flex:1;cursor:pointer" onclick="navigateSnippet('${s.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(s.title)}</span>
          <div style="display:flex;gap:4px">
            <span class="badge badge-${s.type}">${s.type}</span>
            ${s.language ? `<span class="badge" style="background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border)">${escapeHtml(s.language)}</span>` : ""}
          </div>
        </div>
        <div class="card-content"><code>${escapeHtml(truncate(s.content, 100))}</code></div>
        <div class="tags" style="margin-top:6px">${renderTags(s.tags)}</div>
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
  if (!confirm(`Delete ${selectedIds.size} snippets?`)) return;
  try {
    await api.bulkDelete("snippet", [...selectedIds]);
    if (selectedIds.has(currentSnippetId)) {
      currentSnippetId = null;
      currentDetailSnippet = null;
      showEmptyPanel();
    }
    selectedIds.clear();
    await loadSnippets();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function navigateSnippet(id) {
  if (id === currentSnippetId) return;
  if (!confirmLeave()) return;
  try {
    const s = await api.snippets.get(id);
    currentSnippetId = id;
    currentDetailSnippet = s;
    isDirty = false;
    renderList(currentSnippets);
    showDetailPanel(s);
  } catch (err) {
    alert("Failed to load snippet: " + err.message);
  }
}

function showEmptyPanel() {
  document.getElementById("detail-panel").innerHTML = `
    <div class="panel-empty"><p>Select a snippet or create a new one</p></div>
  `;
}

function showDetailPanel(s) {
  currentDetailSnippet = s;
  const panel = document.getElementById("detail-panel");
  let contentHtml;
  if (s.type === "script" || s.type === "snippet") {
    const lang = s.language || "";
    contentHtml = marked.parse("```" + lang + "\n" + s.content + "\n```");
  } else {
    contentHtml = marked.parse(s.content);
  }

  panel.innerHTML = `
    <div class="panel-header">
      <h2 style="min-width:0;word-break:break-word">${escapeHtml(s.title)}</h2>
      <button class="btn btn-primary" style="flex-shrink:0" onclick="openEditPanel()">Edit</button>
    </div>
    <div class="panel-body">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge badge-${s.type}">${s.type}</span>
        ${s.language ? `<span class="badge" style="background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border)">${escapeHtml(s.language)}</span>` : ""}
        <span class="card-meta">${formatDate(s.updatedAt)}</span>
      </div>
      <div class="markdown-content">${contentHtml}</div>
      ${s.tags && s.tags.length > 0 ? `<div class="tags" style="margin-top:12px">${renderTags(s.tags)}</div>` : ""}
    </div>
  `;
}

function showFormPanel(snippet) {
  const isEdit = !!snippet;
  isDirty = false;
  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="panel-header">
      <h2>${isEdit ? "Edit Snippet" : "New Snippet"}</h2>
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
      <div class="form-row">
        <div class="form-group">
          <label for="form-type">Type</label>
          <select id="form-type">
            <option value="snippet">Snippet</option>
            <option value="script">Script</option>
            <option value="template">Template</option>
            <option value="reference">Reference</option>
            <option value="tool">Tool</option>
          </select>
        </div>
        <div class="form-group">
          <label for="form-language">Language (optional)</label>
          <input type="text" id="form-language" placeholder="e.g. python, bash, javascript" />
        </div>
      </div>
      <div class="form-group">
        <label for="form-content">Content</label>
        <textarea id="form-content" rows="12" required></textarea>
      </div>
      <div class="form-group">
        <label for="form-tags">Tags (comma-separated)</label>
        <input type="text" id="form-tags" placeholder="e.g. utility, bash" />
      </div>
    </div>
  `;

  if (isEdit) {
    document.getElementById("form-id").value = snippet.id;
    document.getElementById("form-title").value = snippet.title;
    document.getElementById("form-type").value = snippet.type;
    document.getElementById("form-language").value = snippet.language || "";
    document.getElementById("form-content").value = snippet.content;
    document.getElementById("form-tags").value = snippet.tags.join(", ");
  }

  panel.querySelectorAll("input, textarea, select").forEach(function (el) {
    el.addEventListener("input", function () {
      isDirty = true;
    });
    el.addEventListener("change", function () {
      isDirty = true;
    });
  });
}

function openEditPanel() {
  showFormPanel(currentDetailSnippet);
}

function openCreatePanel() {
  if (!confirmLeave()) return;
  isDirty = false;
  currentSnippetId = null;
  currentDetailSnippet = null;
  renderList(currentSnippets);
  showFormPanel(null);
}

function handleFormCancel() {
  if (!confirmLeave()) return;
  isDirty = false;
  if (currentDetailSnippet) {
    showDetailPanel(currentDetailSnippet);
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

  const data = {
    title: titleEl.value.trim(),
    content: contentEl.value,
    type: document.getElementById("form-type").value,
    language: document.getElementById("form-language").value || undefined,
    tags: tags,
  };

  try {
    let saved;
    if (id) {
      saved = await api.snippets.update(id, data);
    } else {
      saved = await api.snippets.create(data);
    }
    isDirty = false;
    currentSnippetId = saved.id;
    currentDetailSnippet = saved;
    await loadSnippets();
    showDetailPanel(saved);
  } catch (err) {
    alert("Failed to save snippet: " + err.message);
  }
}

async function handleDelete() {
  if (!currentDetailSnippet || !confirm("Delete this snippet?")) return;
  try {
    await api.snippets.delete(currentDetailSnippet.id);
    isDirty = false;
    currentSnippetId = null;
    currentDetailSnippet = null;
    await loadSnippets();
    showEmptyPanel();
  } catch (err) {
    alert("Failed to delete snippet: " + err.message);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.snippets
    .get(editId)
    .then(function (s) {
      currentSnippetId = s.id;
      currentDetailSnippet = s;
      showFormPanel(s);
    })
    .catch(console.error);
}

loadSnippets().then(function () {
  if (!editId) showEmptyPanel();
});
