/**
 * Combined entry point: starts the web UI and MCP HTTP server in a single process.
 *
 * Web UI:      http://localhost:3377  (PORT env to override)
 * MCP HTTP:    http://localhost:3388  (MCP_PORT env to override)
 *
 * Usage:
 *   npm start              # JSON backend (default)
 *   npm run start:sqlite   # SQLite backend
 */

import { logger } from "./core/logger.js";
import { startMcpHttpServer } from "./mcp/http.js";
import { startWebServer } from "./web/app.js";

logger.cleanOldLogs();

startWebServer();
const cleanupMcp = startMcpHttpServer();

process.on("SIGINT", async () => {
  logger.info("app", "Shutting down...");
  await cleanupMcp();
  process.exit(0);
});
