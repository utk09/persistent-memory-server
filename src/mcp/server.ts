import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express from "express";
import os from "os";

import { logger } from "../core/logger.js";
import { closeSession, createSession, updateSessionActivity } from "../core/session-store.js";
import { getSettings } from "../core/settings-store.js";
import { registerAgentTools } from "./tools/agent-tools.js";
import { registerMemoryTools } from "./tools/memory-tools.js";
import { registerSessionTools } from "./tools/session-tools.js";
import { registerSettingsTools } from "./tools/settings-tools.js";
import { registerSnippetTools } from "./tools/snippet-tools.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "persistent-memory-server",
    version: "1.0.0",
  });

  registerMemoryTools(server);
  registerSnippetTools(server);
  registerAgentTools(server);
  registerSessionTools(server);
  registerSettingsTools(server);

  return server;
}

// Clean up old log files on startup
logger.cleanOldLogs();

const isHttpMode = process.argv.includes("--http");

if (isHttpMode) {
  // ---------- HTTP transport (Streamable HTTP + SSE fallback) ----------
  const MCP_PORT = parseInt(process.env.MCP_PORT ?? "3388", 10);
  const app = express();
  app.use(express.json());

  // Helper to extract identity headers from a request, falling back to server settings
  function getClientIdentity(req: express.Request): { user: string; device: string } {
    const settings = getSettings();
    return {
      user: (req.headers["x-user-id"] as string | undefined) ?? settings.defaultUser ?? "anonymous",
      device:
        (req.headers["x-device-name"] as string | undefined) ?? settings.defaultDevice ?? "unknown",
    };
  }

  // --- Streamable HTTP transport (current MCP spec) ---
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (sessionId && transports[sessionId]) {
        updateSessionActivity(sessionId);
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const { user, device } = getClientIdentity(req);
        const ipAddress = req.ip ?? req.socket?.remoteAddress;

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            logger.info("mcp-http", `Session initialized: ${sid} (${user}@${device})`);
            transports[sid] = transport;
            createSession({
              sessionId: sid,
              user,
              device,
              transport: "streamable-http",
              ipAddress,
            });
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info("mcp-http", `Session closed: ${sid}`);
            closeSession(sid);
            delete transports[sid];
          }
        };
        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
    } catch (err) {
      logger.error("mcp-http", `Error handling request: ${err}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET /mcp — Streamable HTTP SSE stream for existing sessions
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    updateSessionActivity(sessionId);
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE /mcp — close a session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // --- SSE transport (legacy / backward compat) ---
  const sseTransports: Record<string, SSEServerTransport> = {};

  app.get("/sse", async (req, res) => {
    try {
      const { user, device } = getClientIdentity(req);
      const ipAddress = req.ip ?? req.socket?.remoteAddress;

      const transport = new SSEServerTransport("/messages", res);
      const sid = transport.sessionId;
      sseTransports[sid] = transport;

      createSession({ sessionId: sid, user, device, transport: "sse", ipAddress });

      transport.onclose = () => {
        logger.info("mcp-sse", `SSE session closed: ${sid}`);
        closeSession(sid);
        delete sseTransports[sid];
      };
      const server = createServer();
      await server.connect(transport);
      logger.info("mcp-sse", `SSE stream established: ${sid} (${user}@${device})`);
    } catch (err) {
      logger.error("mcp-sse", `Error establishing SSE stream: ${err}`);
      if (!res.headersSent) res.status(500).send("Error establishing SSE stream");
    }
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId || !sseTransports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    try {
      updateSessionActivity(sessionId);
      await sseTransports[sessionId].handlePostMessage(req, res, req.body);
    } catch (err) {
      logger.error("mcp-sse", `Error handling message: ${err}`);
      if (!res.headersSent) res.status(500).send("Error handling message");
    }
  });

  app.listen(MCP_PORT, "0.0.0.0", () => {
    logger.info("mcp-http", `MCP HTTP server started on http://localhost:${MCP_PORT}`);
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          logger.info("mcp-http", `Network: http://${net.address}:${MCP_PORT}`);
        }
      }
    }
    logger.info("mcp-http", "Endpoints:");
    logger.info("mcp-http", "  Streamable HTTP: POST/GET/DELETE /mcp");
    logger.info("mcp-http", "  SSE (legacy):    GET /sse  +  POST /messages");
    logger.info("mcp-http", "Identity headers: X-User-Id, X-Device-Name");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("mcp-http", "Shutting down...");
    for (const sid of Object.keys(transports)) {
      closeSession(sid);
      await transports[sid].close?.();
      delete transports[sid];
    }
    for (const sid of Object.keys(sseTransports)) {
      closeSession(sid);
      await sseTransports[sid].close?.();
      delete sseTransports[sid];
    }
    process.exit(0);
  });
} else {
  // ---------- Stdio transport (default, for local Claude Code) ----------
  const user = process.env.MCP_USER ?? "local";
  const device = process.env.MCP_DEVICE ?? os.hostname();
  const stdioSessionId = randomUUID();

  logger.info("mcp", `Starting MCP server via stdio transport (${user}@${device})`);

  createSession({ sessionId: stdioSessionId, user, device, transport: "stdio" });

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("mcp", "MCP server connected and ready");

  process.on("SIGINT", () => {
    closeSession(stdioSessionId);
    process.exit(0);
  });
}
