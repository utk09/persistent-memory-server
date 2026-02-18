import fs from "fs";
import path from "path";

import { logger } from "./logger.js";
import { generateId, getStorePath, nowISO, searchMatches, tagsMatch } from "./utils.js";

export type SnippetType = "script" | "snippet" | "template" | "reference" | "tool";

export type Snippet = {
  id: string;
  title: string;
  content: string;
  type: SnippetType;
  language?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CreateSnippetInput = {
  title: string;
  content: string;
  type: SnippetType;
  language?: string;
  tags?: string[];
};

type UpdateSnippetInput = {
  title?: string;
  content?: string;
  type?: SnippetType;
  language?: string | null;
  tags?: string[];
};

type ListSnippetFilters = {
  type?: SnippetType;
  tags?: string[];
};

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
  fs.writeFileSync(filePath, JSON.stringify(snippet, null, 2), "utf-8");
}

function getAllSnippets(): Snippet[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const snippets: Snippet[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      snippets.push(JSON.parse(data) as Snippet);
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

  if (filters.type) {
    snippets = snippets.filter((s) => s.type === filters.type);
  }

  if (filters.tags && filters.tags.length > 0) {
    snippets = snippets.filter((s) => tagsMatch(s.tags, filters.tags!));
  }

  return snippets;
}

export function searchSnippets(query: string, filters: ListSnippetFilters = {}): Snippet[] {
  const snippets = listSnippets(filters);
  return snippets.filter((s) => searchMatches(s.title, query) || searchMatches(s.content, query));
}

export function countSnippets(): number {
  const dir = getStorePath(STORE_NAME);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}
