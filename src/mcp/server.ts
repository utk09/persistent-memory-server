import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "crypto";
import os from "os";

import { logger } from "../core/logger.js";
import { closeSession, createSession } from "../core/session-store.js";
import { startMcpHttpServer } from "./http.js";
import { registerAgentTools } from "./tools/agent-tools.js";
import { registerMemoryTools } from "./tools/memory-tools.js";
import { registerSessionTools } from "./tools/session-tools.js";
import { registerSettingsTools } from "./tools/settings-tools.js";
import { registerSnippetTools } from "./tools/snippet-tools.js";

logger.cleanOldLogs();

const isHttpMode = process.argv.includes("--http");

if (isHttpMode) {
  const cleanup = startMcpHttpServer();
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
} else {
  // ---------- Stdio transport (default, for local Claude Code) ----------
  const user = process.env.MCP_USER ?? "local";
  const device = process.env.MCP_DEVICE ?? os.hostname();
  const stdioSessionId = randomUUID();

  logger.info("mcp", `Starting MCP server via stdio transport (${user}@${device})`);

  createSession({ sessionId: stdioSessionId, user, device, transport: "stdio" });

  const server = new McpServer({ name: "persistent-memory-server", version: "1.0.0" });
  registerMemoryTools(server);
  registerSnippetTools(server);
  registerAgentTools(server);
  registerSessionTools(server);
  registerSettingsTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("mcp", "MCP server connected and ready");

  process.on("SIGINT", () => {
    closeSession(stdioSessionId);
    process.exit(0);
  });
}
