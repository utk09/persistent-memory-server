import { Router } from "express";

import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  searchAgents,
  updateAgent,
} from "../../core/agent-store.js";
import { logger } from "../../core/logger.js";

const router = Router();

// GET /api/agents - list/search agents
router.get("/", (req, res) => {
  const { user, device, tags, q, limit, offset } = req.query;

  const filters = {
    user: user as string | undefined,
    device: device as string | undefined,
    tags: tags ? (tags as string).split(",") : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  };

  if (q) {
    logger.info("web", `GET /api/agents?q=${q}`);
    const results = searchAgents(q as string, filters);
    res.json(results);
  } else {
    logger.info("web", "GET /api/agents");
    const results = listAgents(filters);
    res.json(results);
  }
});

// POST /api/agents - create agent
router.post("/", (req, res) => {
  logger.info("web", `POST /api/agents: ${req.body.name}`);
  const agent = createAgent(req.body);
  res.status(201).json(agent);
});

// GET /api/agents/:id - get agent
router.get("/:id", (req, res) => {
  logger.info("web", `GET /api/agents/${req.params.id}`);
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

// PUT /api/agents/:id - update agent
router.put("/:id", (req, res) => {
  logger.info("web", `PUT /api/agents/${req.params.id}`);
  const agent = updateAgent(req.params.id, req.body);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

// DELETE /api/agents/:id - delete agent
router.delete("/:id", (req, res) => {
  logger.info("web", `DELETE /api/agents/${req.params.id}`);
  const deleted = deleteAgent(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
