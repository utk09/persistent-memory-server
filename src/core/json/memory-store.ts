import fs from "fs";
import path from "path";

import { logger } from "../logger.js";
import {
  type CreateMemoryInput,
  type ListMemoryFilters,
  type Memory,
  type MemoryRecallResult,
  type RecallContext,
  type UpdateMemoryInput,
} from "../types.js";
import { generateId, getStorePath, isExpired, nowISO, tagsMatch } from "../utils.js";
import { scoreSearch } from "./search.js";

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
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(memory, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

function getAllMemories(): Memory[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const memories: Memory[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      const memory = JSON.parse(data) as Memory;
      if (!memory.user) memory.user = "legacy";
      if (!memory.device) memory.device = "unknown";
      memories.push(memory);
    } catch {
      // Skip corrupted files
    }
  }

  return memories.sort((a, b) => a.id.localeCompare(b.id));
}

export function createMemory(input: CreateMemoryInput): Memory {
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
  if (filters.user) memories = memories.filter((m) => m.user === filters.user);
  if (filters.device) memories = memories.filter((m) => m.device === filters.device);
  if (filters.scope) memories = memories.filter((m) => m.scope === filters.scope);
  if (filters.projectPath) {
    memories = memories.filter((m) => m.projectPath === filters.projectPath);
  }
  if (filters.filePath) memories = memories.filter((m) => m.filePath === filters.filePath);
  if (filters.tags && filters.tags.length > 0) {
    memories = memories.filter((m) => tagsMatch(m.tags, filters.tags!));
  }

  if (filters.offset) memories = memories.slice(filters.offset);
  if (filters.limit) memories = memories.slice(0, filters.limit);

  return memories;
}

export function searchMemories(query: string, filters: ListMemoryFilters = {}): Memory[] {
  const { limit, offset, ...listFilters } = filters;
  const memories = listMemories(listFilters);
  const results = scoreSearch(memories, query);

  let paged = results;
  if (offset) paged = paged.slice(offset);
  if (limit) paged = paged.slice(0, limit);
  return paged;
}

export function recallMemories(context: RecallContext): MemoryRecallResult[] {
  let all = getAllMemories().filter((m) => !isExpired(m.expiresAt));

  if (context.user) all = all.filter((m) => m.user === context.user);
  if (context.device) all = all.filter((m) => m.device === context.device);

  const results: MemoryRecallResult[] = [];

  results.push(
    ...all
      .filter((m) => m.scope === "global")
      .map((m) => ({ ...m, _matchReason: "global" as const })),
  );

  results.push(
    ...all
      .filter(
        (m) =>
          m.scope === "project" && m.projectPath && context.projectPath.startsWith(m.projectPath),
      )
      .map((m) => ({ ...m, _matchReason: "project" as const })),
  );

  if (context.filePath) {
    results.push(
      ...all
        .filter(
          (m) =>
            m.scope === "file" &&
            m.projectPath &&
            context.projectPath.startsWith(m.projectPath) &&
            m.filePath === context.filePath,
        )
        .map((m) => ({ ...m, _matchReason: "file" as const })),
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
