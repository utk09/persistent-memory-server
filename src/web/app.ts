import cors from "cors";
import express from "express";
import os from "os";
import path from "path";

import { logger } from "../core/logger.js";
import agentRoutes from "./routes/agent-routes.js";
import memoryRoutes from "./routes/memory-routes.js";
import sessionRoutes from "./routes/session-routes.js";
import snippetRoutes from "./routes/snippet-routes.js";
import systemRoutes from "./routes/system-routes.js";

export function startWebServer(): void {
  const PORT = parseInt(process.env.PORT ?? "3377", 10);
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  const publicDir = path.resolve(import.meta.dirname, "public");
  app.use(express.static(publicDir));

  app.use("/api/memories", memoryRoutes);
  app.use("/api/snippets", snippetRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api", systemRoutes);

  app.listen(PORT, "0.0.0.0", () => {
    logger.info("web", `Server started on http://localhost:${PORT}`);
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          logger.info("web", `Network: http://${net.address}:${PORT}`);
        }
      }
    }
  });
}
