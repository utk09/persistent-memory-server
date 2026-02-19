import { Router } from "express";

import { logger } from "../../core/logger.js";
import { getSession, listSessions } from "../../core/session-store.js";

const router = Router();

// GET /api/sessions - list sessions
router.get("/", (req, res) => {
  const { user, device, active } = req.query;

  const filters = {
    user: user as string | undefined,
    device: device as string | undefined,
    active: active === "true" ? true : active === "false" ? false : undefined,
  };

  logger.info("web", "GET /api/sessions");
  const sessions = listSessions(filters);
  res.json(sessions);
});

// GET /api/sessions/:id - get session by internal ID
router.get("/:id", (req, res) => {
  logger.info("web", `GET /api/sessions/${req.params.id}`);
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

export default router;
