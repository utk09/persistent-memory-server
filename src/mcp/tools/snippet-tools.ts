import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { logger } from "../../core/logger.js";
import {
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
  searchSnippets,
  updateSnippet,
} from "../../core/snippet-store.js";
import { getToolDescription } from "../../core/tool-catalog.js";

const snippetTypeEnum = z.enum(["script", "snippet", "template", "reference", "tool"]);

export function registerSnippetTools(server: McpServer): void {
  server.registerTool(
    "snippet_create",
    {
      description: getToolDescription("snippet_create"),
      inputSchema: {
        title: z.string().describe("Title of the snippet"),
        content: z.string().describe("Content of the snippet"),
        type: snippetTypeEnum.describe("Type: script, snippet, template, reference, or tool"),
        language: z
          .string()
          .optional()
          .describe("Programming language (e.g. python, bash, markdown)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
      },
    },
    async (params) => {
      logger.info("mcp", `snippet_create: ${params.title}`);
      const snippet = createSnippet(params);
      return {
        content: [{ type: "text", text: JSON.stringify(snippet, null, 2) }],
      };
    },
  );

  server.registerTool(
    "snippet_read",
    {
      description: getToolDescription("snippet_read"),
      inputSchema: {
        id: z.string().describe("Snippet ID"),
      },
    },
    async (params) => {
      logger.info("mcp", `snippet_read: ${params.id}`);
      const snippet = getSnippet(params.id);
      if (!snippet) {
        return {
          content: [{ type: "text", text: `Snippet not found: ${params.id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(snippet, null, 2) }],
      };
    },
  );

  server.registerTool(
    "snippet_update",
    {
      description: getToolDescription("snippet_update"),
      inputSchema: {
        id: z.string().describe("Snippet ID to update"),
        title: z.string().optional().describe("New title"),
        content: z.string().optional().describe("New content"),
        type: snippetTypeEnum.optional().describe("New type"),
        language: z.string().nullable().optional().describe("New language (null to remove)"),
        tags: z.array(z.string()).optional().describe("New tags"),
      },
    },
    async (params) => {
      logger.info("mcp", `snippet_update: ${params.id}`);
      const { id, ...updates } = params;
      const snippet = updateSnippet(id, updates);
      if (!snippet) {
        return {
          content: [{ type: "text", text: `Snippet not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(snippet, null, 2) }],
      };
    },
  );

  server.registerTool(
    "snippet_delete",
    {
      description: getToolDescription("snippet_delete"),
      inputSchema: {
        id: z.string().describe("Snippet ID to delete"),
      },
    },
    async (params) => {
      logger.info("mcp", `snippet_delete: ${params.id}`);
      const deleted = deleteSnippet(params.id);
      return {
        content: [
          {
            type: "text",
            text: deleted ? `Deleted snippet: ${params.id}` : `Snippet not found: ${params.id}`,
          },
        ],
        isError: !deleted,
      };
    },
  );

  server.registerTool(
    "snippet_list",
    {
      description: getToolDescription("snippet_list"),
      inputSchema: {
        type: snippetTypeEnum.optional().describe("Filter by type"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
      },
    },
    async (params) => {
      logger.info("mcp", "snippet_list");
      const snippets = listSnippets(params);
      return {
        content: [{ type: "text", text: JSON.stringify(snippets, null, 2) }],
      };
    },
  );

  server.registerTool(
    "snippet_search",
    {
      description: getToolDescription("snippet_search"),
      inputSchema: {
        query: z.string().describe("Search query"),
        type: snippetTypeEnum.optional().describe("Filter by type"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
      },
    },
    async (params) => {
      logger.info("mcp", `snippet_search: ${params.query}`);
      const { query, ...filters } = params;
      const snippets = searchSnippets(query, filters);
      return {
        content: [{ type: "text", text: JSON.stringify(snippets, null, 2) }],
      };
    },
  );
}
