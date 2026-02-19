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

// Client-side logger: logs to console AND ships to server log files
// Levels: debug < info < warn < error. Default level is "info".
// Enable debug via localStorage: set key "persistent-memory-server" to JSON with "clientLog": "debug"
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const clientLog = {
  _getLevel() {
    try {
      const stored = JSON.parse(localStorage.getItem("persistent-memory-server") || "{}");
      if (stored.clientLog && LOG_LEVELS[stored.clientLog] !== undefined) {
        return LOG_LEVELS[stored.clientLog];
      }
    } catch {
      // ignore
    }
    return LOG_LEVELS.info;
  },
  _send(level, source, message) {
    fetch(`${API_BASE}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, source, message }),
    }).catch(() => {});
  },
  debug(source, message) {
    if (this._getLevel() > LOG_LEVELS.debug) return;
    console.debug(`[${source}]`, message);
    this._send("debug", source, message);
  },
  info(source, message) {
    if (this._getLevel() > LOG_LEVELS.info) return;
    console.info(`[${source}]`, message);
    this._send("info", source, message);
  },
  warn(source, message) {
    if (this._getLevel() > LOG_LEVELS.warn) return;
    console.warn(`[${source}]`, message);
    this._send("warn", source, message);
  },
  error(source, message) {
    console.error(`[${source}]`, message);
    this._send("error", source, String(message));
  },
};

const api = {
  // Memories
  memories: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.scope) query.set("scope", params.scope);
      if (params.projectPath) query.set("projectPath", params.projectPath);
      if (params.filePath) query.set("filePath", params.filePath);
      if (params.tags) query.set("tags", params.tags);
      if (params.user) query.set("user", params.user);
      if (params.device) query.set("device", params.device);
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
    projects: () => apiRequest("/memories/projects"),
  },

  // Snippets
  snippets: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.type) query.set("type", params.type);
      if (params.tags) query.set("tags", params.tags);
      if (params.user) query.set("user", params.user);
      if (params.device) query.set("device", params.device);
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
      if (params.user) query.set("user", params.user);
      if (params.device) query.set("device", params.device);
      if (params.q) query.set("q", params.q);
      const qs = query.toString();
      return apiRequest(`/agents${qs ? `?${qs}` : ""}`);
    },
    get: (id) => apiRequest(`/agents/${id}`),
    create: (data) => apiRequest("/agents", { method: "POST", body: data }),
    update: (id, data) => apiRequest(`/agents/${id}`, { method: "PUT", body: data }),
    delete: (id) => apiRequest(`/agents/${id}`, { method: "DELETE" }),
  },

  // Sessions (read-only)
  sessions: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.user) query.set("user", params.user);
      if (params.device) query.set("device", params.device);
      if (params.active !== undefined) query.set("active", String(params.active));
      const qs = query.toString();
      return apiRequest(`/sessions${qs ? `?${qs}` : ""}`);
    },
    get: (id) => apiRequest(`/sessions/${id}`),
  },

  // Settings
  settings: {
    get: () => apiRequest("/settings"),
    update: (data) => apiRequest("/settings", { method: "PUT", body: data }),
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
    clientLog.warn("ui", "Failed to save to localStorage");
  }
}

// Identity helpers
function getDefaultUser() {
  return getLocalStorage().defaultUser || "";
}

function getDefaultDevice() {
  return getLocalStorage().defaultDevice || "";
}

function setDefaultIdentity(user, device) {
  const stored = getLocalStorage();
  stored.defaultUser = user;
  stored.defaultDevice = device;
  setLocalStorage(stored);
}

function updateIdentityBtn() {
  const btn = document.getElementById("identity-btn");
  if (!btn) return;
  const user = getDefaultUser();
  const device = getDefaultDevice();
  btn.textContent = user || device ? `${user || "?"}@${device || "?"}` : "Set identity";
}

function openIdentityModal() {
  const existing = document.getElementById("identity-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "identity-modal";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <h2>Identity</h2>
        <button class="modal-close" onclick="closeIdentityModal()">✕</button>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Your default user and device name, pre-filled when creating new items.
      </p>
      <div class="form-group">
        <label for="identity-user">User</label>
        <input type="text" id="identity-user" placeholder="e.g. alice" value="${escapeHtml(getDefaultUser())}" />
      </div>
      <div class="form-group">
        <label for="identity-device">Device</label>
        <input type="text" id="identity-device" placeholder="e.g. macbook-pro" value="${escapeHtml(getDefaultDevice())}" />
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeIdentityModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveIdentity()">Save</button>
      </div>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeIdentityModal();
  });
  document.body.appendChild(overlay);
  document.getElementById("identity-user").focus();
}

function closeIdentityModal() {
  const modal = document.getElementById("identity-modal");
  if (modal) modal.remove();
}

function saveIdentity() {
  const user = document.getElementById("identity-user").value.trim();
  const device = document.getElementById("identity-device").value.trim();
  setDefaultIdentity(user, device);
  updateIdentityBtn();
  api.settings.update({ defaultUser: user, defaultDevice: device }).catch(() => {});
  closeIdentityModal();
}

function syncIdentityFromServer() {
  api.settings
    .get()
    .then(function (settings) {
      if (settings.defaultUser || settings.defaultDevice) {
        setDefaultIdentity(settings.defaultUser || "", settings.defaultDevice || "");
        updateIdentityBtn();
      }
    })
    .catch(function () {});
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
  clientLog.debug("theme", "Switched to " + next + " mode");
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
updateIdentityBtn();
syncIdentityFromServer();

// Web Vitals reporting (debug mode only)
(function reportWebVitals() {
  if (clientLog._getLevel() > LOG_LEVELS.debug) return;

  // Largest Contentful Paint
  if (typeof PerformanceObserver !== "undefined") {
    try {
      new PerformanceObserver(function (list) {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          clientLog.debug("web-vitals", "LCP: " + Math.round(last.startTime) + "ms");
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_e) {
      // not supported
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      new PerformanceObserver(function (list) {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        clientLog.debug("web-vitals", "CLS: " + clsValue.toFixed(4));
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_e) {
      // not supported
    }

    // First Input Delay
    try {
      new PerformanceObserver(function (list) {
        const entry = list.getEntries()[0];
        if (entry) {
          clientLog.debug(
            "web-vitals",
            "FID: " + Math.round(entry.processingStart - entry.startTime) + "ms",
          );
        }
      }).observe({ type: "first-input", buffered: true });
    } catch (_e) {
      // not supported
    }
  }

  // Navigation timing (TTFB, DOM load)
  window.addEventListener("load", function () {
    setTimeout(function () {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        clientLog.debug("web-vitals", "TTFB: " + Math.round(nav.responseStart) + "ms");
        clientLog.debug("web-vitals", "DOM Interactive: " + Math.round(nav.domInteractive) + "ms");
        clientLog.debug("web-vitals", "DOM Complete: " + Math.round(nav.domComplete) + "ms");
        clientLog.debug("web-vitals", "Load: " + Math.round(nav.loadEventEnd) + "ms");
      }
    }, 0);
  });
})();
