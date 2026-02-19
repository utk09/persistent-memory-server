/**
 * Migration: copy all JSON data files into the SQLite database.
 *
 * Uses INSERT OR IGNORE, so it's safe to re-run — existing rows with the
 * same ID won't be overwritten or duplicated.
 *
 * Usage: npm run migrate:to-sqlite
 */

import fs from "fs";
import path from "path";

// Force SQLite backend so getDb() initialises the DB file
process.env.DB_BACKEND = "sqlite";

import { getDb } from "../core/sqlite/db.js";

const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

type Counts = { total: number; inserted: number; skipped: number; errors: number };

// ── helpers ───────────────────────────────────────────────────────────────────

function readJsonFiles(store: string): Record<string, unknown>[] {
  const dir = path.join(DATA_DIR, store);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

// ── memories ──────────────────────────────────────────────────────────────────

function migrateMemories(): Counts {
  const db = getDb();
  const counts: Counts = { total: 0, inserted: 0, skipped: 0, errors: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO memories
      (id, user, device, title, content, scope, projectPath, filePath, tags, expiresAt, createdAt, updatedAt)
    VALUES
      (@id, @user, @device, @title, @content, @scope, @projectPath, @filePath, @tags, @expiresAt, @createdAt, @updatedAt)
  `);

  for (const m of readJsonFiles("memories")) {
    counts.total++;
    try {
      const result = insert.run({
        id: m.id,
        user: (m.user as string) || "legacy",
        device: (m.device as string) || "unknown",
        title: m.title,
        content: m.content,
        scope: m.scope,
        projectPath: (m.projectPath as string) ?? null,
        filePath: (m.filePath as string) ?? null,
        tags: JSON.stringify((m.tags as string[]) ?? []),
        expiresAt: (m.expiresAt as string) ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      });
      if (result.changes > 0) {
        counts.inserted++;
      } else {
        counts.skipped++;
      }
    } catch (e) {
      console.error(`[memories] Failed to migrate ${m.id}: ${String(e)}`);
      counts.errors++;
    }
  }
  return counts;
}

// ── snippets ──────────────────────────────────────────────────────────────────

function migrateSnippets(): Counts {
  const db = getDb();
  const counts: Counts = { total: 0, inserted: 0, skipped: 0, errors: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO snippets
      (id, user, device, title, content, type, language, tags, createdAt, updatedAt)
    VALUES
      (@id, @user, @device, @title, @content, @type, @language, @tags, @createdAt, @updatedAt)
  `);

  for (const s of readJsonFiles("snippets")) {
    counts.total++;
    try {
      const result = insert.run({
        id: s.id,
        user: (s.user as string) || "legacy",
        device: (s.device as string) || "unknown",
        title: s.title,
        content: s.content,
        type: s.type,
        language: (s.language as string) ?? null,
        tags: JSON.stringify((s.tags as string[]) ?? []),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
      if (result.changes > 0) {
        counts.inserted++;
      } else {
        counts.skipped++;
      }
    } catch (e) {
      console.error(`[snippets] Failed to migrate ${s.id}: ${String(e)}`);
      counts.errors++;
    }
  }
  return counts;
}

// ── agents ────────────────────────────────────────────────────────────────────

function migrateAgents(): Counts {
  const db = getDb();
  const counts: Counts = { total: 0, inserted: 0, skipped: 0, errors: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO agents
      (id, user, device, name, description, systemPrompt, model, tools, permission, permissionExpiresAt, tags, createdAt, updatedAt)
    VALUES
      (@id, @user, @device, @name, @description, @systemPrompt, @model, @tools, @permission, @permissionExpiresAt, @tags, @createdAt, @updatedAt)
  `);

  for (const a of readJsonFiles("agents")) {
    counts.total++;
    try {
      const result = insert.run({
        id: a.id,
        user: (a.user as string) || "legacy",
        device: (a.device as string) || "unknown",
        name: a.name,
        description: a.description,
        systemPrompt: a.systemPrompt,
        model: (a.model as string) ?? null,
        tools: JSON.stringify((a.tools as string[]) ?? []),
        permission: (a.permission as string) ?? "read-only",
        permissionExpiresAt: (a.permissionExpiresAt as string) ?? null,
        tags: JSON.stringify((a.tags as string[]) ?? []),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });
      if (result.changes > 0) {
        counts.inserted++;
      } else {
        counts.skipped++;
      }
    } catch (e) {
      console.error(`[agents] Failed to migrate ${a.id}: ${String(e)}`);
      counts.errors++;
    }
  }
  return counts;
}

// ── run ───────────────────────────────────────────────────────────────────────

console.info("Migrating JSON data to SQLite...\n");

const mem = migrateMemories();
const snip = migrateSnippets();
const agt = migrateAgents();

console.info(
  `Memories : ${mem.inserted} inserted, ${mem.skipped} skipped, ${mem.errors} errors (${mem.total} total)`,
);
console.info(
  `Snippets : ${snip.inserted} inserted, ${snip.skipped} skipped, ${snip.errors} errors (${snip.total} total)`,
);
console.info(
  `Agents   : ${agt.inserted} inserted, ${agt.skipped} skipped, ${agt.errors} errors (${agt.total} total)`,
);
console.info(`\nMigration complete.`);
