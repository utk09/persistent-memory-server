import { Router } from "express";

import { logger } from "../../core/logger.js";
import type { SnippetType } from "../../core/snippet-store.js";
import {
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
  searchSnippets,
  updateSnippet,
} from "../../core/snippet-store.js";

const router = Router();

// GET /api/snippets - list/search snippets
router.get("/", (req, res) => {
  const { user, device, type, tags, q } = req.query;

  const filters = {
    user: user as string | undefined,
    device: device as string | undefined,
    type: type as SnippetType | undefined,
    tags: tags ? (tags as string).split(",") : undefined,
  };

  if (q) {
    logger.info("web", `GET /api/snippets?q=${q}`);
    const results = searchSnippets(q as string, filters);
    res.json(results);
  } else {
    logger.info("web", "GET /api/snippets");
    const results = listSnippets(filters);
    res.json(results);
  }
});

// POST /api/snippets - create snippet
router.post("/", (req, res) => {
  logger.info("web", `POST /api/snippets: ${req.body.title}`);
  const snippet = createSnippet(req.body);
  res.status(201).json(snippet);
});

// GET /api/snippets/:id - get snippet
router.get("/:id", (req, res) => {
  logger.info("web", `GET /api/snippets/${req.params.id}`);
  const snippet = getSnippet(req.params.id);
  if (!snippet) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.json(snippet);
});

// PUT /api/snippets/:id - update snippet
router.put("/:id", (req, res) => {
  logger.info("web", `PUT /api/snippets/${req.params.id}`);
  const snippet = updateSnippet(req.params.id, req.body);
  if (!snippet) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.json(snippet);
});

// DELETE /api/snippets/:id - delete snippet
router.delete("/:id", (req, res) => {
  logger.info("web", `DELETE /api/snippets/${req.params.id}`);
  const deleted = deleteSnippet(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
