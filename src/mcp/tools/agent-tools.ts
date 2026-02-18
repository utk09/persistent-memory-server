import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  searchAgents,
  updateAgent,
} from "../../core/agent-store.js";
import { logger } from "../../core/logger.js";
import { getToolDescription } from "../../core/tool-catalog.js";

const permissionEnum = z.enum(["read-only", "read-write"]);

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    "agent_create",
    {
      description: getToolDescription("agent_create"),
      inputSchema: {
        name: z.string().describe("Agent name"),
        description: z.string().describe("Agent description"),
        systemPrompt: z.string().describe("System prompt for the agent"),
        model: z.string().optional().describe("Model identifier (e.g. claude-sonnet-4-6)"),
        tools: z.array(z.string()).optional().describe("Tool names this agent can use"),
        permission: permissionEnum.optional().describe("Permission level (default: read-only)"),
        permissionExpiresAt: z
          .string()
          .optional()
          .describe("Write permission expiration (ISO 8601)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
      },
    },
    async (params) => {
      logger.info("mcp", `agent_create: ${params.name}`);
      const agent = createAgent(params);
      return {
        content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
      };
    },
  );

  server.registerTool(
    "agent_read",
    {
      description: getToolDescription("agent_read"),
      inputSchema: {
        id: z.string().describe("Agent ID"),
      },
    },
    async (params) => {
      logger.info("mcp", `agent_read: ${params.id}`);
      const agent = getAgent(params.id);
      if (!agent) {
        return {
          content: [{ type: "text", text: `Agent not found: ${params.id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
      };
    },
  );

  server.registerTool(
    "agent_update",
    {
      description: getToolDescription("agent_update"),
      inputSchema: {
        id: z.string().describe("Agent ID to update"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
        systemPrompt: z.string().optional().describe("New system prompt"),
        model: z.string().nullable().optional().describe("Model identifier (null to remove)"),
        tools: z.array(z.string()).optional().describe("New tools list"),
        permission: permissionEnum.optional().describe("New permission level"),
        permissionExpiresAt: z
          .string()
          .nullable()
          .optional()
          .describe("New permission expiration (null to remove)"),
        tags: z.array(z.string()).optional().describe("New tags"),
      },
    },
    async (params) => {
      logger.info("mcp", `agent_update: ${params.id}`);
      const { id, ...updates } = params;
      const agent = updateAgent(id, updates);
      if (!agent) {
        return {
          content: [{ type: "text", text: `Agent not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
      };
    },
  );

  server.registerTool(
    "agent_delete",
    {
      description: getToolDescription("agent_delete"),
      inputSchema: {
        id: z.string().describe("Agent ID to delete"),
      },
    },
    async (params) => {
      logger.info("mcp", `agent_delete: ${params.id}`);
      const deleted = deleteAgent(params.id);
      return {
        content: [
          {
            type: "text",
            text: deleted ? `Deleted agent: ${params.id}` : `Agent not found: ${params.id}`,
          },
        ],
        isError: !deleted,
      };
    },
  );

  server.registerTool(
    "agent_list",
    {
      description: getToolDescription("agent_list"),
      inputSchema: {
        tags: z.array(z.string()).optional().describe("Filter by tags"),
      },
    },
    async (params) => {
      logger.info("mcp", "agent_list");
      const agents = listAgents(params);
      return {
        content: [{ type: "text", text: JSON.stringify(agents, null, 2) }],
      };
    },
  );

  server.registerTool(
    "agent_search",
    {
      description: getToolDescription("agent_search"),
      inputSchema: {
        query: z.string().describe("Search query"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
      },
    },
    async (params) => {
      logger.info("mcp", `agent_search: ${params.query}`);
      const { query, ...filters } = params;
      const agents = searchAgents(query, filters);
      return {
        content: [{ type: "text", text: JSON.stringify(agents, null, 2) }],
      };
    },
  );
}
