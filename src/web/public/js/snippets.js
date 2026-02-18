let selectedIds = new Set();

const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const tagFilter = document.getElementById("tag-filter");

searchInput.addEventListener("input", debounce(loadSnippets));
typeFilter.addEventListener("change", loadSnippets);
tagFilter.addEventListener("input", debounce(loadSnippets));

async function loadSnippets() {
  const params = {};
  if (searchInput.value.trim()) params.q = searchInput.value.trim();
  if (typeFilter.value) params.type = typeFilter.value;
  if (tagFilter.value.trim()) params.tags = tagFilter.value.trim();

  try {
    const snippets = await api.snippets.list(params);
    renderSnippets(snippets);
  } catch (err) {
    console.error("Failed to load snippets:", err);
  }
}

function renderSnippets(snippets) {
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
    <div class="card" style="display: flex; gap: 12px; align-items: flex-start">
      <input type="checkbox" class="bulk-checkbox" data-id="${s.id}" onchange="toggleSelect('${s.id}', this.checked)" onclick="event.stopPropagation()" />
      <div style="flex: 1" onclick="viewSnippet('${s.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(s.title)}</span>
          <div style="display: flex; gap: 4px">
            <span class="badge badge-${s.type}">${s.type}</span>
            ${s.language ? `<span class="badge" style="background: var(--bg-secondary); color: var(--text-secondary)">${escapeHtml(s.language)}</span>` : ""}
          </div>
        </div>
        <div class="card-content"><code>${escapeHtml(truncate(s.content, 150))}</code></div>
        <div class="tags">${renderTags(s.tags)}</div>
        <div class="card-meta" style="margin-top: 4px">${formatDate(s.updatedAt)}</div>
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
    selectedIds.clear();
    await loadSnippets();
  } catch (err) {
    alert("Bulk delete failed: " + err.message);
  }
}

async function viewSnippet(id) {
  try {
    const s = await api.snippets.get(id);
    document.getElementById("view-title").textContent = s.title;
    document.getElementById("view-meta").innerHTML = `
      <span class="badge badge-${s.type}">${s.type}</span>
      ${s.language ? ` &middot; ${escapeHtml(s.language)}` : ""}
      &middot; ${formatDate(s.updatedAt)}
    `;

    // Render content: code block for scripts/snippets, markdown for others
    if (s.type === "script" || s.type === "snippet") {
      const lang = s.language || "";
      document.getElementById("view-content").innerHTML = marked.parse(
        "```" + lang + "\n" + s.content + "\n```",
      );
    } else {
      document.getElementById("view-content").innerHTML = marked.parse(s.content);
    }

    document.getElementById("view-tags").innerHTML = renderTags(s.tags);
    document.getElementById("view-edit-btn").onclick = () => {
      closeViewModal();
      openEditModal(s);
    };
    document.getElementById("view-overlay").style.display = "flex";
  } catch (err) {
    alert("Failed to load snippet: " + err.message);
  }
}

function closeViewModal() {
  document.getElementById("view-overlay").style.display = "none";
}

function openCreateModal() {
  document.getElementById("modal-title").textContent = "New Snippet";
  document.getElementById("submit-btn").textContent = "Create";
  document.getElementById("delete-btn").style.display = "none";
  document.getElementById("form-id").value = "";
  document.getElementById("snippet-form").reset();
  document.getElementById("modal-overlay").style.display = "flex";
}

function openEditModal(s) {
  document.getElementById("modal-title").textContent = "Edit Snippet";
  document.getElementById("submit-btn").textContent = "Save";
  document.getElementById("delete-btn").style.display = "inline-flex";
  document.getElementById("form-id").value = s.id;
  document.getElementById("form-title").value = s.title;
  document.getElementById("form-type").value = s.type;
  document.getElementById("form-language").value = s.language || "";
  document.getElementById("form-content").value = s.content;
  document.getElementById("form-tags").value = s.tags.join(", ");
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

  const data = {
    title: document.getElementById("form-title").value,
    content: document.getElementById("form-content").value,
    type: document.getElementById("form-type").value,
    language: document.getElementById("form-language").value || undefined,
    tags,
  };

  try {
    if (id) {
      await api.snippets.update(id, data);
    } else {
      await api.snippets.create(data);
    }
    closeModal();
    await loadSnippets();
  } catch (err) {
    alert("Failed to save snippet: " + err.message);
  }
}

async function handleDelete() {
  const id = document.getElementById("form-id").value;
  if (!id || !confirm("Delete this snippet?")) return;
  try {
    await api.snippets.delete(id);
    closeModal();
    await loadSnippets();
  } catch (err) {
    alert("Failed to delete snippet: " + err.message);
  }
}

setupModalClose("modal-overlay", closeModal);
setupModalClose("view-overlay", closeViewModal);

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
if (editId) {
  api.snippets.get(editId).then(openEditModal).catch(console.error);
}

loadSnippets();
