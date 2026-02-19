# Persistent Memory Server

A self-hosted MCP server + web UI for storing memories, snippets, and agent configurations persistently across Claude Code sessions.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
git clone https://github.com/utk09/persistent-memory-server
cd persistent-memory-server
npm install
pwd  # note the absolute path — needed for MCP setup below
```

## Running

### Combined (web UI + MCP HTTP in one process)

```bash
npm start              # JSON backend
npm run start:sqlite   # SQLite backend
```

Starts both servers together — web UI on [http://localhost:3377](http://localhost:3377) and MCP HTTP on port 3388. One process, one `Ctrl+C` to stop everything.

### Separately

```bash
npm run start:web          # web UI only (port 3377)
npm run start:mcp-http     # MCP HTTP only (port 3388)
```

### MCP Server (Claude Code integration)

**stdio (local — recommended):**

```bash
claude mcp add persistent-memory -- npx jiti /absolute/path/to/persistent-memory-server/src/mcp/server.ts
```

Restart Claude Code. The MCP tools become available automatically.

To remove: `claude mcp remove persistent-memory`

**HTTP (network/remote):**

```bash
npm run start:mcp-http
# configurable: MCP_PORT=3388 npx jiti src/mcp/server.ts --http
```

Connect from Claude Code:

```bash
claude mcp add persistent-memory --transport http http://<host-ip>:3388/mcp
```

## Storage Backend

By default all data is stored as JSON files in `data/`. To use SQLite instead (better for larger datasets, full-text search via FTS5):

```bash
# Start with SQLite
npm run start:web:sqlite
npm run start:mcp:sqlite
npm run start:mcp-http:sqlite

# Migrate existing JSON data to SQLite (safe to re-run)
npm run migrate:to-sqlite
```

Set your default user/device name from the identity button in the web UI nav bar — this is used to tag all created entries and avoids anonymous attribution.

## What You Can Store

### Memories

Persistent notes scoped to where they apply:

| Scope | When it loads | Example use |
| ------- | -------------- | ------------- |
| **global** | Always | Coding preferences, universal rules |
| **project** | In matching project paths (prefix match) | Repo conventions, tech stack notes |
| **file** | On a specific file within a project | "Don't refactor the legacy parser here" |

Supports tags, markdown content, and optional expiration dates. Monorepos work naturally via prefix matching.

### Snippets

Reusable code and text, typed as: `script`, `snippet`, `template`, `reference`, or `tool`. Each can have a language tag for syntax highlighting.

### Agents

Stored agent configurations: system prompt, allowed tools list, and permission model (read-only by default; read-write with optional expiry).

## Search

Both backends support advanced search syntax:

- `"exact phrase"` — phrase must appear (highest score)
- `-excludeterm` — hard-excludes entries containing the term
- `term1 term2` — both terms must appear; results ranked by relevance

JSON backend uses a scored ranking algorithm. SQLite backend uses FTS5.

## MCP Tools Reference

### Memory

| Tool | Description |
| ------ | ------------- |
| `memory_create` | Create a memory with scope, tags, optional expiry |
| `memory_read` | Get a memory by ID |
| `memory_update` | Update fields; set `expiresAt: null` to remove expiry |
| `memory_delete` | Delete a memory |
| `memory_list` | List/filter by scope, project, tags, user, device |
| `memory_search` | Full-text search with phrase/negative syntax |
| `memory_recall` | Get all relevant memories for a context (global + project + file) |
| `context_checkpoint` | Save a session summary as a project-scoped memory |

### Snippet

| Tool | Description |
| ------ | ------------- |
| `snippet_create` | Create a snippet |
| `snippet_read` | Get a snippet by ID |
| `snippet_update` | Update a snippet |
| `snippet_delete` | Delete a snippet |
| `snippet_list` | List/filter by type, tags, user, device |
| `snippet_search` | Full-text search |

### Agent

| Tool | Description |
| ------ | ------------- |
| `agent_create` | Create an agent config |
| `agent_read` | Get an agent by ID |
| `agent_update` | Update an agent |
| `agent_delete` | Delete an agent |
| `agent_list` | List/filter by tags, user, device |
| `agent_search` | Search by name/description |

### Sessions & Settings

| Tool | Description |
| ------ | ------------- |
| `session_list` | List active/past MCP sessions |
| `session_get` | Get a session by ID |
| `settings_get` | Read configured default user/device identity |

## Other Scripts

```bash
npm run export:file       # Export all data to a JSON file
npm run import:file       # Import data from a JSON file
npm run stats             # Print usage stats
npm run migrate:to-sqlite # Migrate JSON data to SQLite (idempotent)
npm run lint              # Type-check + lint
npm run lint:fix          # Auto-fix lint issues
```

## Data Storage

| Backend | Location | Notes |
| --------- | ---------- | ------- |
| JSON (default) | `data/memories/`, `data/snippets/`, `data/agents/` | One file per record |
| SQLite | `data/db.sqlite` | WAL mode, FTS5 full-text search |

Logs go to `logs/` with daily rotation (30-day retention). Neither data nor logs are git-tracked.

---

License: [AGPL-3.0](LICENSE)
