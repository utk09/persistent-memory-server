import cors from "cors";
import express from "express";
import path from "path";

import { logger } from "../core/logger.js";
import agentRoutes from "./routes/agent-routes.js";
import memoryRoutes from "./routes/memory-routes.js";
import snippetRoutes from "./routes/snippet-routes.js";
import systemRoutes from "./routes/system-routes.js";

const PORT = parseInt(process.env.PORT ?? "3377", 10);
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Static files
const publicDir = path.resolve(import.meta.dirname, "public");
app.use(express.static(publicDir));

// API routes
app.use("/api/memories", memoryRoutes);
app.use("/api/snippets", snippetRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api", systemRoutes);

// Clean up old log files on startup
logger.cleanOldLogs();

app.listen(PORT, "0.0.0.0", () => {
  logger.info("web", `Server started on http://localhost:${PORT}`);
});
