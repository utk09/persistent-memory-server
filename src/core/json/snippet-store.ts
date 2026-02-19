import fs from "fs";
import path from "path";

import { logger } from "../logger.js";
import {
  type CreateSnippetInput,
  type ListSnippetFilters,
  type Snippet,
  type UpdateSnippetInput,
} from "../types.js";
import { generateId, getStorePath, nowISO, tagsMatch } from "../utils.js";
import { scoreSearch } from "./search.js";

const STORE_NAME = "snippets";

function getFilePath(id: string): string {
  return path.join(getStorePath(STORE_NAME), `${id}.json`);
}

function readSnippet(id: string): Snippet | null {
  const filePath = getFilePath(id);
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as Snippet;
  } catch {
    return null;
  }
}

function writeSnippet(snippet: Snippet): void {
  const filePath = getFilePath(snippet.id);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(snippet, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

function getAllSnippets(): Snippet[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const snippets: Snippet[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      const snippet = JSON.parse(data) as Snippet;
      if (!snippet.user) snippet.user = "legacy";
      if (!snippet.device) snippet.device = "unknown";
      snippets.push(snippet);
    } catch {
      // Skip corrupted files
    }
  }

  return snippets.sort((a, b) => a.id.localeCompare(b.id));
}

export function createSnippet(input: CreateSnippetInput): Snippet {
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
  writeSnippet(snippet);
  logger.info("snippet-store", `Created snippet: ${snippet.id} (${snippet.title})`);
  return snippet;
}

export function getSnippet(id: string): Snippet | null {
  return readSnippet(id);
}

export function updateSnippet(id: string, input: UpdateSnippetInput): Snippet | null {
  const snippet = readSnippet(id);
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

  writeSnippet(snippet);
  logger.info("snippet-store", `Updated snippet: ${id}`);
  return snippet;
}

export function deleteSnippet(id: string): boolean {
  const filePath = getFilePath(id);
  try {
    fs.unlinkSync(filePath);
    logger.info("snippet-store", `Deleted snippet: ${id}`);
    return true;
  } catch {
    return false;
  }
}

export function listSnippets(filters: ListSnippetFilters = {}): Snippet[] {
  let snippets = getAllSnippets();

  if (filters.user) snippets = snippets.filter((s) => s.user === filters.user);
  if (filters.device) snippets = snippets.filter((s) => s.device === filters.device);
  if (filters.type) snippets = snippets.filter((s) => s.type === filters.type);
  if (filters.tags && filters.tags.length > 0) {
    snippets = snippets.filter((s) => tagsMatch(s.tags, filters.tags!));
  }

  if (filters.offset) snippets = snippets.slice(filters.offset);
  if (filters.limit) snippets = snippets.slice(0, filters.limit);

  return snippets;
}

export function searchSnippets(query: string, filters: ListSnippetFilters = {}): Snippet[] {
  const { limit, offset, ...listFilters } = filters;
  const snippets = listSnippets(listFilters);
  const results = scoreSearch(snippets, query);

  let paged = results;
  if (offset) paged = paged.slice(offset);
  if (limit) paged = paged.slice(0, limit);
  return paged;
}

export function countSnippets(): number {
  const dir = getStorePath(STORE_NAME);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}
