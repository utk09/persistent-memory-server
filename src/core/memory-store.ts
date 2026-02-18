import fs from "fs";
import path from "path";

import { logger } from "./logger.js";
import { generateId, getStorePath, isExpired, nowISO, searchMatches, tagsMatch } from "./utils.js";

export type MemoryScope = "global" | "project" | "file";

export type Memory = {
  id: string;
  title: string;
  content: string;
  scope: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

type CreateMemoryInput = {
  title: string;
  content: string;
  scope: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  expiresAt?: string;
};

type UpdateMemoryInput = {
  title?: string;
  content?: string;
  scope?: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  expiresAt?: string | null; // null to remove expiration
};

type ListMemoryFilters = {
  scope?: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  includeExpired?: boolean;
};

type RecallContext = {
  projectPath: string;
  filePath?: string;
};

const STORE_NAME = "memories";

function getFilePath(id: string): string {
  return path.join(getStorePath(STORE_NAME), `${id}.json`);
}

function readMemory(id: string): Memory | null {
  const filePath = getFilePath(id);
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as Memory;
  } catch {
    return null;
  }
}

function writeMemory(memory: Memory): void {
  const filePath = getFilePath(memory.id);
  fs.writeFileSync(filePath, JSON.stringify(memory, null, 2), "utf-8");
}

function getAllMemories(): Memory[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const memories: Memory[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      memories.push(JSON.parse(data) as Memory);
    } catch {
      // Skip corrupted files
    }
  }

  // UUIDv7 filenames are naturally sorted by creation time
  return memories.sort((a, b) => a.id.localeCompare(b.id));
}

export function createMemory(input: CreateMemoryInput): Memory {
  const now = nowISO();
  const memory: Memory = {
    id: generateId(),
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

  writeMemory(memory);
  logger.info("memory-store", `Created memory: ${memory.id} (${memory.title})`);
  return memory;
}

export function getMemory(id: string): Memory | null {
  return readMemory(id);
}

export function updateMemory(id: string, input: UpdateMemoryInput): Memory | null {
  const memory = readMemory(id);
  if (!memory) return null;

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

  writeMemory(memory);
  logger.info("memory-store", `Updated memory: ${id}`);
  return memory;
}

export function deleteMemory(id: string): boolean {
  const filePath = getFilePath(id);
  try {
    fs.unlinkSync(filePath);
    logger.info("memory-store", `Deleted memory: ${id}`);
    return true;
  } catch {
    return false;
  }
}

export function listMemories(filters: ListMemoryFilters = {}): Memory[] {
  let memories = getAllMemories();

  if (!filters.includeExpired) {
    memories = memories.filter((m) => !isExpired(m.expiresAt));
  }

  if (filters.scope) {
    memories = memories.filter((m) => m.scope === filters.scope);
  }

  if (filters.projectPath) {
    memories = memories.filter((m) => m.projectPath && m.projectPath === filters.projectPath);
  }

  if (filters.filePath) {
    memories = memories.filter((m) => m.filePath === filters.filePath);
  }

  if (filters.tags && filters.tags.length > 0) {
    memories = memories.filter((m) => tagsMatch(m.tags, filters.tags!));
  }

  return memories;
}

export function searchMemories(query: string, filters: ListMemoryFilters = {}): Memory[] {
  const memories = listMemories(filters);
  return memories.filter((m) => searchMatches(m.title, query) || searchMatches(m.content, query));
}

export function recallMemories(context: RecallContext): Memory[] {
  const all = getAllMemories().filter((m) => !isExpired(m.expiresAt));

  const results: Memory[] = [];

  // 1. All global memories
  results.push(...all.filter((m) => m.scope === "global"));

  // 2. Project memories where projectPath is a prefix of the context path
  results.push(
    ...all.filter(
      (m) =>
        m.scope === "project" && m.projectPath && context.projectPath.startsWith(m.projectPath),
    ),
  );

  // 3. File memories matching the exact file within a matching project
  if (context.filePath) {
    results.push(
      ...all.filter(
        (m) =>
          m.scope === "file" &&
          m.projectPath &&
          context.projectPath.startsWith(m.projectPath) &&
          m.filePath === context.filePath,
      ),
    );
  }

  logger.info(
    "memory-store",
    `Recall for ${context.projectPath}${context.filePath ? `/${context.filePath}` : ""}: ${results.length} memories`,
  );

  return results;
}

export function countMemories(): number {
  const dir = getStorePath(STORE_NAME);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}
