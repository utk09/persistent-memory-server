import { logger } from "../logger.js";
import {
  type CreateMemoryInput,
  type ListMemoryFilters,
  type Memory,
  type MemoryRecallResult,
  type MemoryScope,
  type RecallContext,
  type UpdateMemoryInput,
} from "../types.js";
import { generateId, isExpired, nowISO, tagsMatch } from "../utils.js";
import { getDb } from "./db.js";

// ── Row mapping ───────────────────────────────────────────────────────────────

type MemoryRow = {
  id: string;
  user: string;
  device: string;
  title: string;
  content: string;
  scope: string;
  projectPath: string | null;
  filePath: string | null;
  tags: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    user: row.user,
    device: row.device,
    title: row.title,
    content: row.content,
    scope: row.scope as MemoryScope,
    projectPath: row.projectPath ?? undefined,
    filePath: row.filePath ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function memoryToRow(memory: Memory): Omit<MemoryRow, "projectPath" | "filePath" | "expiresAt"> & {
  projectPath: string | null;
  filePath: string | null;
  expiresAt: string | null;
} {
  return {
    id: memory.id,
    user: memory.user,
    device: memory.device,
    title: memory.title,
    content: memory.content,
    scope: memory.scope,
    projectPath: memory.projectPath ?? null,
    filePath: memory.filePath ?? null,
    tags: JSON.stringify(memory.tags),
    expiresAt: memory.expiresAt ?? null,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

// ── FTS helpers ───────────────────────────────────────────────────────────────

/**
 * Extracts a clean FTS5 query (positive terms + quoted phrases) and separate
 * negative terms to filter in-process.
 */
function parseFtsQuery(rawQuery: string): { fts5: string; negatives: string[] } {
  const parts: string[] = [];
  const negatives: string[] = [];

  let q = rawQuery;
  const phraseRegex = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = phraseRegex.exec(rawQuery)) !== null) {
    parts.push(`"${m[1].replace(/"/g, "")}"`);
  }
  q = q.replace(/"[^"]+"/g, " ");

  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("-") && token.length > 1) {
      negatives.push(token.slice(1).toLowerCase());
    } else {
      // Sanitize: FTS5 doesn't like most punctuation in bare terms
      const clean = token.replace(/[^\w]/g, "");
      if (clean) parts.push(clean);
    }
  }

  return { fts5: parts.join(" "), negatives };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createMemory(input: CreateMemoryInput): Memory {
  const db = getDb();
  const now = nowISO();
  const memory: Memory = {
    id: generateId(),
    user: input.user,
    device: input.device,
    title: input.title,
    content: input.content,
    scope: input.scope,
    projectPath: input.projectPath,
    filePath: input.filePath,
    tags: input.tags ?? [],
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  const row = memoryToRow(memory);
  db.prepare(
    `
    INSERT INTO memories (id, user, device, title, content, scope, projectPath, filePath, tags, expiresAt, createdAt, updatedAt)
    VALUES (@id, @user, @device, @title, @content, @scope, @projectPath, @filePath, @tags, @expiresAt, @createdAt, @updatedAt)
  `,
  ).run(row);

  logger.info("memory-store", `Created memory: ${memory.id} (${memory.title})`);
  return memory;
}

export function getMemory(id: string): Memory | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as MemoryRow | undefined;
  return row ? rowToMemory(row) : null;
}

export function updateMemory(id: string, input: UpdateMemoryInput): Memory | null {
  const memory = getMemory(id);
  if (!memory) return null;

  if (input.user !== undefined) memory.user = input.user;
  if (input.device !== undefined) memory.device = input.device;
  if (input.title !== undefined) memory.title = input.title;
  if (input.content !== undefined) memory.content = input.content;
  if (input.scope !== undefined) memory.scope = input.scope;
  if (input.projectPath !== undefined) memory.projectPath = input.projectPath;
  if (input.filePath !== undefined) memory.filePath = input.filePath;
  if (input.tags !== undefined) memory.tags = input.tags;
  if (input.expiresAt === null) {
    delete memory.expiresAt;
  } else if (input.expiresAt !== undefined) {
    memory.expiresAt = input.expiresAt;
  }
  memory.updatedAt = nowISO();

  const db = getDb();
  const row = memoryToRow(memory);
  db.prepare(
    `
    UPDATE memories SET
      user = @user, device = @device, title = @title, content = @content,
      scope = @scope, projectPath = @projectPath, filePath = @filePath,
      tags = @tags, expiresAt = @expiresAt, updatedAt = @updatedAt
    WHERE id = @id
  `,
  ).run(row);

  logger.info("memory-store", `Updated memory: ${id}`);
  return memory;
}

export function deleteMemory(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  if (result.changes > 0) {
    logger.info("memory-store", `Deleted memory: ${id}`);
    return true;
  }
  return false;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function listMemories(filters: ListMemoryFilters = {}): Memory[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (!filters.includeExpired) {
    conditions.push("(expiresAt IS NULL OR expiresAt > @now)");
    params.now = nowISO();
  }
  if (filters.user) {
    conditions.push("user = @user");
    params.user = filters.user;
  }
  if (filters.device) {
    conditions.push("device = @device");
    params.device = filters.device;
  }
  if (filters.scope) {
    conditions.push("scope = @scope");
    params.scope = filters.scope;
  }
  if (filters.projectPath) {
    conditions.push("projectPath = @projectPath");
    params.projectPath = filters.projectPath;
  }
  if (filters.filePath) {
    conditions.push("filePath = @filePath");
    params.filePath = filters.filePath;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let memories = (
    db.prepare(`SELECT * FROM memories ${where} ORDER BY id`).all(params) as MemoryRow[]
  ).map(rowToMemory);

  // Tags: partial match requires in-process filtering
  if (filters.tags && filters.tags.length > 0) {
    memories = memories.filter((m) => tagsMatch(m.tags, filters.tags!));
  }

  if (filters.offset) memories = memories.slice(filters.offset);
  if (filters.limit) memories = memories.slice(0, filters.limit);

  return memories;
}

export function searchMemories(query: string, filters: ListMemoryFilters = {}): Memory[] {
  if (!query.trim()) return listMemories(filters);

  const db = getDb();
  const { fts5, negatives } = parseFtsQuery(query);

  if (!fts5.trim()) {
    // Only negative terms — list everything and filter
    let all = listMemories(filters);
    for (const neg of negatives) {
      all = all.filter(
        (m) => !m.title.toLowerCase().includes(neg) && !m.content.toLowerCase().includes(neg),
      );
    }
    return all;
  }

  // Fetch IDs from FTS5, then get full rows
  const ftsRows = db
    .prepare("SELECT id FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank")
    .all(fts5) as { id: string }[];

  if (ftsRows.length === 0) return [];

  const ids = ftsRows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  let memories = (
    db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...ids) as MemoryRow[]
  ).map(rowToMemory);

  // Restore FTS rank order
  const rankMap = new Map(ids.map((id, i) => [id, i]));
  memories.sort((a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0));

  // Apply remaining filters in-process
  if (!filters.includeExpired) memories = memories.filter((m) => !isExpired(m.expiresAt));
  if (filters.user) memories = memories.filter((m) => m.user === filters.user);
  if (filters.device) memories = memories.filter((m) => m.device === filters.device);
  if (filters.scope) memories = memories.filter((m) => m.scope === filters.scope);
  if (filters.projectPath) memories = memories.filter((m) => m.projectPath === filters.projectPath);
  if (filters.filePath) memories = memories.filter((m) => m.filePath === filters.filePath);
  if (filters.tags && filters.tags.length > 0) {
    memories = memories.filter((m) => tagsMatch(m.tags, filters.tags!));
  }

  // Apply negatives
  for (const neg of negatives) {
    memories = memories.filter(
      (m) => !m.title.toLowerCase().includes(neg) && !m.content.toLowerCase().includes(neg),
    );
  }

  const { offset, limit } = filters;
  if (offset) memories = memories.slice(offset);
  if (limit) memories = memories.slice(0, limit);

  return memories;
}

export function recallMemories(context: RecallContext): MemoryRecallResult[] {
  const db = getDb();
  const now = nowISO();
  const params: Record<string, unknown> = {
    now,
    user: context.user ?? null,
    device: context.device ?? null,
    projectPath: context.projectPath,
    filePath: context.filePath ?? null,
  };

  const rows = db
    .prepare(
      `
      SELECT * FROM memories
      WHERE (expiresAt IS NULL OR expiresAt > @now)
        AND (@user IS NULL OR user = @user)
        AND (@device IS NULL OR device = @device)
        AND (
          scope = 'global'
          OR (scope = 'project' AND projectPath IS NOT NULL AND instr(@projectPath, projectPath) = 1)
          OR (scope = 'file'    AND projectPath IS NOT NULL AND instr(@projectPath, projectPath) = 1
                                AND filePath = @filePath)
        )
      ORDER BY
        CASE scope WHEN 'global' THEN 1 WHEN 'project' THEN 2 WHEN 'file' THEN 3 END,
        id
    `,
    )
    .all(params) as MemoryRow[];

  const memories = rows.map(rowToMemory);

  const results: MemoryRecallResult[] = memories.map((m) => ({
    ...m,
    _matchReason: m.scope as "global" | "project" | "file",
  }));

  logger.info(
    "memory-store",
    `Recall for ${context.projectPath}${context.filePath ? `/${context.filePath}` : ""}: ${results.length} memories`,
  );

  return results;
}

export function countMemories(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM memories").get() as { count: number };
  return row.count;
}
