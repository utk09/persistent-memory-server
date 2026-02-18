async function loadDashboard() {
  try {
    const data = await api.stats();

    document.getElementById("stat-memories").textContent = data.counts.memories;
    document.getElementById("stat-snippets").textContent = data.counts.snippets;
    document.getElementById("stat-agents").textContent = data.counts.agents;

    const list = document.getElementById("recent-list");

    if (data.recent.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No entries yet. Create your first memory, snippet, or agent.</p></div>`;
      return;
    }

    list.innerHTML = data.recent
      .map(
        (item) => `
      <div class="card" onclick="navigateTo('${item.type}', '${item.id}')">
        <div class="card-header">
          <span class="card-title">${escapeHtml(item.title)}</span>
          <span class="badge badge-${item.type === "agent" ? "tool" : item.type === "snippet" ? "snippet" : "global"}">${item.type}</span>
        </div>
        <div class="card-meta">${formatDate(item.updatedAt)}</div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    clientLog.error("dashboard", "Failed to load dashboard: " + err.message);
  }
}

function navigateTo(type, id) {
  clientLog.info("dashboard", "Navigate to " + type + " " + id);
  const pages = { memory: "memories", snippet: "snippets", agent: "agents" };
  window.location.href = `/${pages[type]}.html?view=${id}`;
}

async function handleExport() {
  clientLog.info("dashboard", "Export initiated");
  try {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "memory-server-export.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    clientLog.error("dashboard", "Export failed: " + err.message);
    alert("Export failed: " + err.message);
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  clientLog.info("dashboard", "Import initiated: " + file.name);

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await api.importData(data);
    alert(`Imported ${result.imported} entries successfully.`);
    await loadDashboard();
  } catch (err) {
    clientLog.error("dashboard", "Import failed: " + err.message);
    alert("Import failed: " + err.message);
  }

  event.target.value = "";
}

loadDashboard();
