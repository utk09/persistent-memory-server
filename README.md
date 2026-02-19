# Persistent Memory Server

A local server for managing persistent memories, reusable snippets, and agent configurations for AI coding assistants like Claude Code. Provides a web UI and an MCP interface for seamless integration

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
git clone https://github.com/utk09/persistent-memory-server
# or download zip and extract

cd persistent-memory-server

npm install

pwd # Note the absolute path for MCP server setup
```

## Running

### Web UI

```bash
npm run start:web
```

Opens at [http://localhost:3377](http://localhost:3377). Use `PORT=4000 npm run start:web` to change the port.

### MCP Server (for Claude Code)

**Local (stdio — default):**

```bash
claude mcp add persistent-memory -- npx jiti /absolute/path/to/persistent-memory-server/src/mcp/server.ts

# replace /absolute/path/to/persistent-memory-server with the actual path from `pwd` above
# best way to check is to run `npx jiti /absolute/path/to/persistent-memory-server/src/mcp/server.ts` directly in terminal - if it starts the server, the path is correct
```

To remove:

```bash
claude mcp remove persistent-memory
```

Then restart Claude Code. The MCP tools will be available automatically.

**Remote / Network (HTTP transport):**

Start the MCP HTTP server on the host machine:

```bash
npm run start:mcp-http
# or: MCP_PORT=3388 npx jiti src/mcp/server.ts --http
```

This starts an HTTP server on port 3388 (configurable via `MCP_PORT`) with two transports:

- **Streamable HTTP** (current spec): `POST /mcp`
- **SSE** (legacy): `GET /sse` + `POST /messages`

On the remote machine, connect Claude Code:

```bash
# Streamable HTTP (recommended)
claude mcp add persistent-memory --transport http http://<host-ip>:3388/mcp

# SSE (legacy fallback)
claude mcp add persistent-memory --transport sse http://<host-ip>:3388/sse
```

Replace `<host-ip>` with the network IP shown in the server startup logs.

## What You Can Do

### Memories

Persistent notes organized by scope:

- **Global** - coding preferences, universal rules (e.g. "always use single quotes")
- **Project** - project-specific conventions (e.g. "this repo uses Tailwind")
- **File** - instructions for specific files (e.g. "don't refactor the legacy parser here")

Supports tags, markdown content, and optional expiration dates. Monorepos work naturally - project memories match by path prefix.

### Snippets

Reusable code and text, categorized by type:

- `script` - executable scripts
- `snippet` - code fragments
- `template` - reusable templates
- `reference` - documentation/notes
- `tool` - tool definitions

Each snippet can have a language tag (e.g. `python`, `bash`) for syntax highlighting.

### Agents

Stored agent configurations with:

- System prompt
- Allowed tools list
- Permission model (read-only by default, read-write with optional expiry)

## MCP Tools Reference

| Tool | Description |
| ------ | ------------- |
| `memory_create` | Create a memory with scope, tags, and optional expiry |
| `memory_read` | Get a memory by ID |
| `memory_update` | Update a memory |
| `memory_delete` | Delete a memory |
| `memory_list` | List/filter memories by scope, project, tags |
| `memory_search` | Search memories by keyword |
| `memory_recall` | Get all relevant memories for current context (global + project + file) |
| `snippet_create` | Create a snippet |
| `snippet_read` | Get a snippet by ID |
| `snippet_update` | Update a snippet |
| `snippet_delete` | Delete a snippet |
| `snippet_list` | List/filter snippets by type and tags |
| `snippet_search` | Search snippets by keyword |
| `agent_create` | Create an agent config |
| `agent_read` | Get an agent by ID |
| `agent_update` | Update an agent |
| `agent_delete` | Delete an agent |
| `agent_list` | List/filter agents by tags |
| `agent_search` | Search agents by keyword |

## Other Scripts

```bash
npm run export:file   # Export all data to JSON
npm run import:file   # Import data from JSON
npm run stats         # Print usage stats
npm run lint          # Run linter
npm run lint:fix      # Auto-fix lint issues
```

## Data Storage

All data is stored as JSON files in the `data/` directory. Logs go to `logs/` with daily rotation (30-day retention). Neither is git-tracked.
