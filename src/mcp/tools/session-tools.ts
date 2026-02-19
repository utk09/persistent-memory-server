import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { logger } from "../../core/logger.js";
import { getSession, listSessions } from "../../core/session-store.js";
import { getToolDescription } from "../../core/tool-catalog.js";

export function registerSessionTools(server: McpServer): void {
  server.registerTool(
    "session_list",
    {
      description: getToolDescription("session_list"),
      inputSchema: {
        user: z.string().optional().describe("Filter by user"),
        device: z.string().optional().describe("Filter by device"),
        active: z
          .boolean()
          .optional()
          .describe("true = active sessions only, false = closed only, omit = all"),
      },
    },
    async (params) => {
      logger.info("mcp", "session_list");
      const sessions = listSessions(params);
      return {
        content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
      };
    },
  );

  server.registerTool(
    "session_get",
    {
      description: getToolDescription("session_get"),
      inputSchema: {
        id: z.string().describe("Session internal ID"),
      },
    },
    async (params) => {
      logger.info("mcp", `session_get: ${params.id}`);
      const session = getSession(params.id);
      if (!session) {
        return {
          content: [{ type: "text", text: `Session not found: ${params.id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
      };
    },
  );
}
