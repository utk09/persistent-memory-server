import { logger } from "../logger.js";
import {
  type CreateSnippetInput,
  type ListSnippetFilters,
  type Snippet,
  type SnippetType,
  type UpdateSnippetInput,
} from "../types.js";
import { generateId, nowISO, tagsMatch } from "../utils.js";
import { getDb } from "./db.js";

// ── Row mapping ───────────────────────────────────────────────────────────────

type SnippetRow = {
  id: string;
  user: string;
  device: string;
  title: string;
  content: string;
  type: string;
  language: string | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    user: row.user,
    device: row.device,
    title: row.title,
    content: row.content,
    type: row.type as SnippetType,
    language: row.language ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── FTS helpers ───────────────────────────────────────────────────────────────

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
      const clean = token.replace(/[^\w]/g, "");
      if (clean) parts.push(clean);
    }
  }

  return { fts5: parts.join(" "), negatives };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createSnippet(input: CreateSnippetInput): Snippet {
  const db = getDb();
  const now = nowISO();
  const snippet: Snippet = {
    id: generateId(),
    user: input.user,
    device: input.device,
    title: input.title,
    content: input.content,
    type: input.type,
    language: input.language,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `
    INSERT INTO snippets (id, user, device, title, content, type, language, tags, createdAt, updatedAt)
    VALUES (@id, @user, @device, @title, @content, @type, @language, @tags, @createdAt, @updatedAt)
  `,
  ).run({
    ...snippet,
    language: snippet.language ?? null,
    tags: JSON.stringify(snippet.tags),
  });

  logger.info("snippet-store", `Created snippet: ${snippet.id} (${snippet.title})`);
  return snippet;
}

export function getSnippet(id: string): Snippet | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM snippets WHERE id = ?").get(id) as SnippetRow | undefined;
  return row ? rowToSnippet(row) : null;
}

export function updateSnippet(id: string, input: UpdateSnippetInput): Snippet | null {
  const snippet = getSnippet(id);
  if (!snippet) return null;

  if (input.user !== undefined) snippet.user = input.user;
  if (input.device !== undefined) snippet.device = input.device;
  if (input.title !== undefined) snippet.title = input.title;
  if (input.content !== undefined) snippet.content = input.content;
  if (input.type !== undefined) snippet.type = input.type;
  if (input.language === null) {
    delete snippet.language;
  } else if (input.language !== undefined) {
    snippet.language = input.language;
  }
  if (input.tags !== undefined) snippet.tags = input.tags;
  snippet.updatedAt = nowISO();

  const db = getDb();
  db.prepare(
    `
    UPDATE snippets SET
      user = @user, device = @device, title = @title, content = @content,
      type = @type, language = @language, tags = @tags, updatedAt = @updatedAt
    WHERE id = @id
  `,
  ).run({
    id: snippet.id,
    user: snippet.user,
    device: snippet.device,
    title: snippet.title,
    content: snippet.content,
    type: snippet.type,
    language: snippet.language ?? null,
    tags: JSON.stringify(snippet.tags),
    updatedAt: snippet.updatedAt,
  });

  logger.info("snippet-store", `Updated snippet: ${id}`);
  return snippet;
}

export function deleteSnippet(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM snippets WHERE id = ?").run(id);
  if (result.changes > 0) {
    logger.info("snippet-store", `Deleted snippet: ${id}`);
    return true;
  }
  return false;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function listSnippets(filters: ListSnippetFilters = {}): Snippet[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.user) {
    conditions.push("user = @user");
    params.user = filters.user;
  }
  if (filters.device) {
    conditions.push("device = @device");
    params.device = filters.device;
  }
  if (filters.type) {
    conditions.push("type = @type");
    params.type = filters.type;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let snippets = (
    db.prepare(`SELECT * FROM snippets ${where} ORDER BY id`).all(params) as SnippetRow[]
  ).map(rowToSnippet);

  if (filters.tags && filters.tags.length > 0) {
    snippets = snippets.filter((s) => tagsMatch(s.tags, filters.tags!));
  }

  if (filters.offset) snippets = snippets.slice(filters.offset);
  if (filters.limit) snippets = snippets.slice(0, filters.limit);

  return snippets;
}

export function searchSnippets(query: string, filters: ListSnippetFilters = {}): Snippet[] {
  if (!query.trim()) return listSnippets(filters);

  const db = getDb();
  const { fts5, negatives } = parseFtsQuery(query);

  if (!fts5.trim()) {
    let all = listSnippets(filters);
    for (const neg of negatives) {
      all = all.filter(
        (s) => !s.title.toLowerCase().includes(neg) && !s.content.toLowerCase().includes(neg),
      );
    }
    return all;
  }

  const ftsRows = db
    .prepare("SELECT id FROM snippets_fts WHERE snippets_fts MATCH ? ORDER BY rank")
    .all(fts5) as { id: string }[];

  if (ftsRows.length === 0) return [];

  const ids = ftsRows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  let snippets = (
    db.prepare(`SELECT * FROM snippets WHERE id IN (${placeholders})`).all(...ids) as SnippetRow[]
  ).map(rowToSnippet);

  // Restore FTS rank order
  const rankMap = new Map(ids.map((id, i) => [id, i]));
  snippets.sort((a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0));

  if (filters.user) snippets = snippets.filter((s) => s.user === filters.user);
  if (filters.device) snippets = snippets.filter((s) => s.device === filters.device);
  if (filters.type) snippets = snippets.filter((s) => s.type === filters.type);
  if (filters.tags && filters.tags.length > 0) {
    snippets = snippets.filter((s) => tagsMatch(s.tags, filters.tags!));
  }

  for (const neg of negatives) {
    snippets = snippets.filter(
      (s) => !s.title.toLowerCase().includes(neg) && !s.content.toLowerCase().includes(neg),
    );
  }

  const { offset, limit } = filters;
  if (offset) snippets = snippets.slice(offset);
  if (limit) snippets = snippets.slice(0, limit);

  return snippets;
}

export function countSnippets(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM snippets").get() as { count: number };
  return row.count;
}
