import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { logger } from "../core/logger.js";
import { registerAgentTools } from "./tools/agent-tools.js";
import { registerMemoryTools } from "./tools/memory-tools.js";
import { registerSnippetTools } from "./tools/snippet-tools.js";

const server = new McpServer({
  name: "persistent-memory-server",
  version: "1.0.0",
});

// Register all tools
registerMemoryTools(server);
registerSnippetTools(server);
registerAgentTools(server);

// Clean up old log files on startup
logger.cleanOldLogs();

logger.info("mcp", "Starting MCP server via stdio transport");

const transport = new StdioServerTransport();
await server.connect(transport);

logger.info("mcp", "MCP server connected and ready");
