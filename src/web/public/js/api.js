// API client helper
const API_BASE = "/api";

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

const api = {
  // Memories
  memories: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.scope) query.set("scope", params.scope);
      if (params.projectPath) query.set("projectPath", params.projectPath);
      if (params.filePath) query.set("filePath", params.filePath);
      if (params.tags) query.set("tags", params.tags);
      if (params.q) query.set("q", params.q);
      if (params.includeExpired) query.set("includeExpired", "true");
      const qs = query.toString();
      return apiRequest(`/memories${qs ? `?${qs}` : ""}`);
    },
    get: (id) => apiRequest(`/memories/${id}`),
    create: (data) => apiRequest("/memories", { method: "POST", body: data }),
    update: (id, data) => apiRequest(`/memories/${id}`, { method: "PUT", body: data }),
    delete: (id) => apiRequest(`/memories/${id}`, { method: "DELETE" }),
    recall: (data) => apiRequest("/memories/recall", { method: "POST", body: data }),
  },

  // Snippets
  snippets: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.type) query.set("type", params.type);
      if (params.tags) query.set("tags", params.tags);
      if (params.q) query.set("q", params.q);
      const qs = query.toString();
      return apiRequest(`/snippets${qs ? `?${qs}` : ""}`);
    },
    get: (id) => apiRequest(`/snippets/${id}`),
    create: (data) => apiRequest("/snippets", { method: "POST", body: data }),
    update: (id, data) => apiRequest(`/snippets/${id}`, { method: "PUT", body: data }),
    delete: (id) => apiRequest(`/snippets/${id}`, { method: "DELETE" }),
  },

  // Agents
  agents: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.tags) query.set("tags", params.tags);
      if (params.q) query.set("q", params.q);
      const qs = query.toString();
      return apiRequest(`/agents${qs ? `?${qs}` : ""}`);
    },
    get: (id) => apiRequest(`/agents/${id}`),
    create: (data) => apiRequest("/agents", { method: "POST", body: data }),
    update: (id, data) => apiRequest(`/agents/${id}`, { method: "PUT", body: data }),
    delete: (id) => apiRequest(`/agents/${id}`, { method: "DELETE" }),
  },

  // System
  tools: () => apiRequest("/tools"),
  stats: () => apiRequest("/stats"),
  exportData: () => apiRequest("/export", { method: "POST" }),
  importData: (data) => apiRequest("/import", { method: "POST", body: data }),
  bulkDelete: (type, ids) => apiRequest("/bulk/delete", { method: "POST", body: { type, ids } }),
  bulkTag: (type, ids, tags, action) =>
    apiRequest("/bulk/tag", { method: "POST", body: { type, ids, tags, action } }),
};

// Helper: render tags
function renderTags(tags) {
  return tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
}

// Helper: escape HTML
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Helper: format date
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper: truncate text
function truncate(str, len = 120) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

// Helper: check if memory is expiring soon (within 7 days)
function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

// Helper: close modal on overlay click
function setupModalClose(overlayId, closeFn) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeFn();
    });
  }
}

// Helper: debounce
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Theme helpers
const LS_KEY = "persistent-memory-server";

function getLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setLocalStorage(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    console.warn("Failed to save to localStorage");
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const isDark =
    root.classList.contains("dark") ||
    (!root.classList.contains("light") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  root.className = next;
  const stored = getLocalStorage();
  stored.theme = next;
  setLocalStorage(stored);
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const root = document.documentElement;
  const isDark =
    root.classList.contains("dark") ||
    (!root.classList.contains("light") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  btn.textContent = isDark ? "☀" : "🌙";
}

updateThemeButton();
