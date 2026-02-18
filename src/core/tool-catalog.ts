export type ToolEntry = {
  name: string;
  group: string;
  description: string;
};

// Single source of truth for all MCP tool metadata.
// Used by both the MCP registration (registerTool) and the web API (GET /api/tools).
const memoryTools: ToolEntry[] = [
  {
    name: "memory_create",
    group: "Memory",
    description:
      "Create a new memory entry with title, content, scope (global/project/file), and optional tags",
  },
  { name: "memory_read", group: "Memory", description: "Read a memory entry by its ID" },
  {
    name: "memory_update",
    group: "Memory",
    description: "Update an existing memory entry (title, content, tags, scope, or expiration)",
  },
  { name: "memory_delete", group: "Memory", description: "Delete a memory entry by its ID" },
  {
    name: "memory_list",
    group: "Memory",
    description: "List memories, optionally filtered by scope, project, file, and/or tags",
  },
  {
    name: "memory_search",
    group: "Memory",
    description: "Search memories by keyword (searches title and content)",
  },
  {
    name: "memory_recall",
    group: "Memory",
    description:
      "Get all relevant memories for the current context. Returns global + matching project + matching file memories, with file > project > global priority.",
  },
  {
    name: "context_checkpoint",
    group: "Memory",
    description:
      "Save important session context to persistent memory before compaction. Call this proactively when context is getting long, before starting a new major task, or when asked to remember the current state.",
  },
];

const snippetTools: ToolEntry[] = [
  {
    name: "snippet_create",
    group: "Snippet",
    description:
      "Create a new snippet (script, code snippet, template, reference, or tool definition)",
  },
  { name: "snippet_read", group: "Snippet", description: "Read a snippet by its ID" },
  { name: "snippet_update", group: "Snippet", description: "Update an existing snippet" },
  { name: "snippet_delete", group: "Snippet", description: "Delete a snippet by its ID" },
  {
    name: "snippet_list",
    group: "Snippet",
    description: "List all snippets, optionally filtered by type and/or tags",
  },
  {
    name: "snippet_search",
    group: "Snippet",
    description: "Search snippets by keyword (searches title and content)",
  },
];

const agentTools: ToolEntry[] = [
  {
    name: "agent_create",
    group: "Agent",
    description:
      "Create a new agent configuration with name, description, system prompt, and optional tools/permissions",
  },
  {
    name: "agent_read",
    group: "Agent",
    description: "Read an agent configuration by its ID",
  },
  { name: "agent_update", group: "Agent", description: "Update an existing agent configuration" },
  {
    name: "agent_delete",
    group: "Agent",
    description: "Delete an agent configuration by its ID",
  },
  {
    name: "agent_list",
    group: "Agent",
    description: "List all agent configurations, optionally filtered by tags",
  },
  {
    name: "agent_search",
    group: "Agent",
    description: "Search agents by keyword (searches name and description)",
  },
];

export const TOOL_CATALOG: ToolEntry[] = [...memoryTools, ...snippetTools, ...agentTools];

/** Look up a tool description by name. */
export function getToolDescription(name: string): string {
  const entry = TOOL_CATALOG.find((t) => t.name === name);
  if (!entry) throw new Error(`Unknown tool: ${name}`);
  return entry.description;
}
