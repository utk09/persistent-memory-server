import { Router } from "express";
import fs from "fs";
import path from "path";

import { countAgents, deleteAgent, listAgents } from "../../core/agent-store.js";
import { logger } from "../../core/logger.js";
import { countMemories, deleteMemory, listMemories } from "../../core/memory-store.js";
import { countSnippets, deleteSnippet, listSnippets } from "../../core/snippet-store.js";
import { DATA_DIR } from "../../core/utils.js";

const router = Router();

// GET /api/stats - dashboard stats
router.get("/stats", (_req, res) => {
  logger.info("web", "GET /api/stats");

  const memories = listMemories();
  const snippets = listSnippets();
  const agents = listAgents();

  // Recent entries (last 10 across all types)
  const recent = [
    ...memories.map((m) => ({
      type: "memory" as const,
      id: m.id,
      title: m.title,
      updatedAt: m.updatedAt,
    })),
    ...snippets.map((s) => ({
      type: "snippet" as const,
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
    })),
    ...agents.map((a) => ({
      type: "agent" as const,
      id: a.id,
      title: a.name,
      updatedAt: a.updatedAt,
    })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);

  res.json({
    counts: {
      memories: countMemories(),
      snippets: countSnippets(),
      agents: countAgents(),
    },
    recent,
  });
});

// POST /api/export - export all data as JSON
router.post("/export", (_req, res) => {
  logger.info("web", "POST /api/export");

  const data = {
    memories: listMemories({ includeExpired: true }),
    snippets: listSnippets(),
    agents: listAgents(),
    exportedAt: new Date().toISOString(),
  };

  res.setHeader("Content-Disposition", "attachment; filename=memory-server-export.json");
  res.json(data);
});

// POST /api/import - import data from JSON
router.post("/import", (req, res) => {
  logger.info("web", "POST /api/import");

  const { memories, snippets, agents } = req.body;
  let imported = 0;

  if (memories && Array.isArray(memories)) {
    for (const memory of memories) {
      const filePath = path.join(DATA_DIR, "memories", `${memory.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2), "utf-8");
      imported++;
    }
  }

  if (snippets && Array.isArray(snippets)) {
    for (const snippet of snippets) {
      const filePath = path.join(DATA_DIR, "snippets", `${snippet.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(snippet, null, 2), "utf-8");
      imported++;
    }
  }

  if (agents && Array.isArray(agents)) {
    for (const agent of agents) {
      const filePath = path.join(DATA_DIR, "agents", `${agent.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(agent, null, 2), "utf-8");
      imported++;
    }
  }

  logger.info("web", `Imported ${imported} entries`);
  res.json({ success: true, imported });
});

// POST /api/bulk/delete - bulk delete by IDs and resource type
router.post("/bulk/delete", (req, res) => {
  const { type, ids } = req.body as { type: string; ids: string[] };
  logger.info("web", `POST /api/bulk/delete: ${type} (${ids.length} items)`);

  let deleted = 0;
  const deleteFn =
    type === "memory"
      ? deleteMemory
      : type === "snippet"
        ? deleteSnippet
        : type === "agent"
          ? deleteAgent
          : null;

  if (!deleteFn) {
    res.status(400).json({ error: "Invalid type. Use: memory, snippet, or agent" });
    return;
  }

  for (const id of ids) {
    if (deleteFn(id)) deleted++;
  }

  res.json({ success: true, deleted });
});

// POST /api/bulk/tag - bulk update tags
router.post("/bulk/tag", (req, res) => {
  const { type, ids, tags, action } = req.body as {
    type: string;
    ids: string[];
    tags: string[];
    action: "add" | "remove" | "set";
  };
  logger.info("web", `POST /api/bulk/tag: ${type} (${ids.length} items, ${action})`);

  let updated = 0;

  for (const id of ids) {
    let filePath: string;
    if (type === "memory") {
      filePath = path.join(DATA_DIR, "memories", `${id}.json`);
    } else if (type === "snippet") {
      filePath = path.join(DATA_DIR, "snippets", `${id}.json`);
    } else if (type === "agent") {
      filePath = path.join(DATA_DIR, "agents", `${id}.json`);
    } else {
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const currentTags: string[] = data.tags || [];

      if (action === "add") {
        data.tags = [...new Set([...currentTags, ...tags])];
      } else if (action === "remove") {
        data.tags = currentTags.filter((t: string) => !tags.includes(t));
      } else if (action === "set") {
        data.tags = tags;
      }

      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      updated++;
    } catch {
      // Skip entries that don't exist
    }
  }

  res.json({ success: true, updated });
});

export default router;
