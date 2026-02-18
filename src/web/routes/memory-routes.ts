import { Router } from "express";

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

const router = Router();

// GET /api/memories - list/search memories
router.get("/", (req, res) => {
  const { scope, projectPath, filePath, tags, q, includeExpired } = req.query;

  const filters = {
    scope: scope as "global" | "project" | "file" | undefined,
    projectPath: projectPath as string | undefined,
    filePath: filePath as string | undefined,
    tags: tags ? (tags as string).split(",") : undefined,
    includeExpired: includeExpired === "true",
  };

  if (q) {
    logger.info("web", `GET /api/memories?q=${q}`);
    const results = searchMemories(q as string, filters);
    res.json(results);
  } else {
    logger.info("web", "GET /api/memories");
    const results = listMemories(filters);
    res.json(results);
  }
});

// POST /api/memories - create memory
router.post("/", (req, res) => {
  logger.info("web", `POST /api/memories: ${req.body.title}`);
  const memory = createMemory(req.body);
  res.status(201).json(memory);
});

// POST /api/memories/recall - get relevant memories for context
router.post("/recall", (req, res) => {
  const { projectPath, filePath } = req.body;
  logger.info("web", `POST /api/memories/recall: ${projectPath}`);
  const memories = recallMemories({ projectPath, filePath });
  res.json(memories);
});

// GET /api/memories/:id - get memory
router.get("/:id", (req, res) => {
  logger.info("web", `GET /api/memories/${req.params.id}`);
  const memory = getMemory(req.params.id);
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(memory);
});

// PUT /api/memories/:id - update memory
router.put("/:id", (req, res) => {
  logger.info("web", `PUT /api/memories/${req.params.id}`);
  const memory = updateMemory(req.params.id, req.body);
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(memory);
});

// DELETE /api/memories/:id - delete memory
router.delete("/:id", (req, res) => {
  logger.info("web", `DELETE /api/memories/${req.params.id}`);
  const deleted = deleteMemory(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
