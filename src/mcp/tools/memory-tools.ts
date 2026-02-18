import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { logger } from "../../core/logger.js";
import {
  createMemory,
  deleteMemory,
  getMemory,
  listMemories,
  recallMemories,
  searchMemories,
  updateMemory,
} from "../../core/memory-store.js";

const scopeEnum = z.enum(["global", "project", "file"]);

export function registerMemoryTools(server: McpServer): void {
  server.tool(
    "memory_create",
    "Create a new memory entry with title, content, scope (global/project/file), and optional tags",
    {
      title: z.string().describe("Title of the memory"),
      content: z.string().describe("Content of the memory (markdown supported)"),
      scope: scopeEnum.describe("Memory scope: global, project, or file"),
      projectPath: z
        .string()
        .optional()
        .describe("Absolute project path (required for project/file scope)"),
      filePath: z
        .string()
        .optional()
        .describe("File path relative to projectPath (required for file scope)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      expiresAt: z.string().optional().describe("Expiration date in ISO 8601 format"),
    },
    async (params) => {
      logger.info("mcp", `memory_create: ${params.title}`);
      const memory = createMemory(params);
      return {
        content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_read",
    "Read a memory entry by its ID",
    {
      id: z.string().describe("Memory ID"),
    },
    async (params) => {
      logger.info("mcp", `memory_read: ${params.id}`);
      const memory = getMemory(params.id);
      if (!memory) {
        return {
          content: [{ type: "text", text: `Memory not found: ${params.id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_update",
    "Update an existing memory entry (title, content, tags, scope, or expiration)",
    {
      id: z.string().describe("Memory ID to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content"),
      scope: scopeEnum.optional().describe("New scope"),
      projectPath: z.string().optional().describe("New project path"),
      filePath: z.string().optional().describe("New file path"),
      tags: z.array(z.string()).optional().describe("New tags"),
      expiresAt: z.string().nullable().optional().describe("New expiration date (null to remove)"),
    },
    async (params) => {
      logger.info("mcp", `memory_update: ${params.id}`);
      const { id, ...updates } = params;
      const memory = updateMemory(id, updates);
      if (!memory) {
        return {
          content: [{ type: "text", text: `Memory not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_delete",
    "Delete a memory entry by its ID",
    {
      id: z.string().describe("Memory ID to delete"),
    },
    async (params) => {
      logger.info("mcp", `memory_delete: ${params.id}`);
      const deleted = deleteMemory(params.id);
      return {
        content: [
          {
            type: "text",
            text: deleted ? `Deleted memory: ${params.id}` : `Memory not found: ${params.id}`,
          },
        ],
        isError: !deleted,
      };
    },
  );

  server.tool(
    "memory_list",
    "List memories, optionally filtered by scope, project, file, and/or tags",
    {
      scope: scopeEnum.optional().describe("Filter by scope"),
      projectPath: z.string().optional().describe("Filter by project path"),
      filePath: z.string().optional().describe("Filter by file path"),
      tags: z.array(z.string()).optional().describe("Filter by tags (all must match)"),
      includeExpired: z.boolean().optional().describe("Include expired memories (default: false)"),
    },
    async (params) => {
      logger.info("mcp", "memory_list");
      const memories = listMemories(params);
      return {
        content: [{ type: "text", text: JSON.stringify(memories, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_search",
    "Search memories by keyword (searches title and content)",
    {
      query: z.string().describe("Search query"),
      scope: scopeEnum.optional().describe("Filter by scope"),
      projectPath: z.string().optional().describe("Filter by project path"),
      filePath: z.string().optional().describe("Filter by file path"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async (params) => {
      logger.info("mcp", `memory_search: ${params.query}`);
      const { query, ...filters } = params;
      const memories = searchMemories(query, filters);
      return {
        content: [{ type: "text", text: JSON.stringify(memories, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_recall",
    "Get all relevant memories for the current context. Returns global + matching project + matching file memories, with file > project > global priority.",
    {
      projectPath: z.string().describe("Current project path (absolute)"),
      filePath: z.string().optional().describe("Current file path (relative to project)"),
    },
    async (params) => {
      logger.info(
        "mcp",
        `memory_recall: ${params.projectPath}${params.filePath ? `/${params.filePath}` : ""}`,
      );
      const memories = recallMemories(params);
      return {
        content: [{ type: "text", text: JSON.stringify(memories, null, 2) }],
      };
    },
  );
}
