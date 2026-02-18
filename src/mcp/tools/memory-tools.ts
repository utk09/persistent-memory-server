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
import { getToolDescription } from "../../core/tool-catalog.js";

const scopeEnum = z.enum(["global", "project", "file"]);

export function registerMemoryTools(server: McpServer): void {
  server.registerTool(
    "memory_create",
    {
      description: getToolDescription("memory_create"),
      inputSchema: {
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
    },
    async (params) => {
      logger.info("mcp", `memory_create: ${params.title}`);
      const memory = createMemory(params);
      return {
        content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
      };
    },
  );

  server.registerTool(
    "memory_read",
    {
      description: getToolDescription("memory_read"),
      inputSchema: {
        id: z.string().describe("Memory ID"),
      },
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

  server.registerTool(
    "memory_update",
    {
      description: getToolDescription("memory_update"),
      inputSchema: {
        id: z.string().describe("Memory ID to update"),
        title: z.string().optional().describe("New title"),
        content: z.string().optional().describe("New content"),
        scope: scopeEnum.optional().describe("New scope"),
        projectPath: z.string().optional().describe("New project path"),
        filePath: z.string().optional().describe("New file path"),
        tags: z.array(z.string()).optional().describe("New tags"),
        expiresAt: z
          .string()
          .nullable()
          .optional()
          .describe("New expiration date (null to remove)"),
      },
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

  server.registerTool(
    "memory_delete",
    {
      description: getToolDescription("memory_delete"),
      inputSchema: {
        id: z.string().describe("Memory ID to delete"),
      },
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

  server.registerTool(
    "memory_list",
    {
      description: getToolDescription("memory_list"),
      inputSchema: {
        scope: scopeEnum.optional().describe("Filter by scope"),
        projectPath: z.string().optional().describe("Filter by project path"),
        filePath: z.string().optional().describe("Filter by file path"),
        tags: z.array(z.string()).optional().describe("Filter by tags (all must match)"),
        includeExpired: z
          .boolean()
          .optional()
          .describe("Include expired memories (default: false)"),
      },
    },
    async (params) => {
      logger.info("mcp", "memory_list");
      const memories = listMemories(params);
      return {
        content: [{ type: "text", text: JSON.stringify(memories, null, 2) }],
      };
    },
  );

  server.registerTool(
    "memory_search",
    {
      description: getToolDescription("memory_search"),
      inputSchema: {
        query: z.string().describe("Search query"),
        scope: scopeEnum.optional().describe("Filter by scope"),
        projectPath: z.string().optional().describe("Filter by project path"),
        filePath: z.string().optional().describe("Filter by file path"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
      },
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

  server.registerTool(
    "context_checkpoint",
    {
      description: getToolDescription("context_checkpoint"),
      inputSchema: {
        title: z.string().describe("Short descriptive title for the checkpoint"),
        summary: z
          .string()
          .describe(
            "Markdown summary of what was done, key decisions, current state, and what comes next",
          ),
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to current project (omit for global scope)"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Additional tags beyond the default 'checkpoint' and date tags"),
      },
    },
    async (params) => {
      logger.info("mcp", `context_checkpoint: ${params.title}`);
      const today = new Date().toISOString().slice(0, 10);
      const memory = createMemory({
        title: params.title,
        content: params.summary,
        scope: params.projectPath ? "project" : "global",
        projectPath: params.projectPath,
        tags: ["checkpoint", today, ...(params.tags ?? [])],
      });
      return {
        content: [
          {
            type: "text",
            text: `Checkpoint saved (${memory.id})\nTitle: ${memory.title}\nScope: ${memory.scope}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "memory_recall",
    {
      description: getToolDescription("memory_recall"),
      inputSchema: {
        projectPath: z.string().describe("Current project path (absolute)"),
        filePath: z.string().optional().describe("Current file path (relative to project)"),
      },
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
