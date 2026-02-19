/**
 * Dispatcher: routes to JSON or SQLite backend based on DB_BACKEND env var.
 */
export type {
  CreateMemoryInput,
  ListMemoryFilters,
  Memory,
  MemoryRecallResult,
  MemoryScope,
  RecallContext,
  UpdateMemoryInput,
} from "./types.js";

import { USE_SQLITE } from "./backend-config.js";
import * as json from "./json/memory-store.js";
import * as sqlite from "./sqlite/memory-store.js";

const impl = USE_SQLITE ? sqlite : json;

export const createMemory: typeof impl.createMemory = (input) => impl.createMemory(input);
export const getMemory: typeof impl.getMemory = (id) => impl.getMemory(id);
export const updateMemory: typeof impl.updateMemory = (id, input) => impl.updateMemory(id, input);
export const deleteMemory: typeof impl.deleteMemory = (id) => impl.deleteMemory(id);
export const listMemories: typeof impl.listMemories = (filters) => impl.listMemories(filters);
export const searchMemories: typeof impl.searchMemories = (query, filters) =>
  impl.searchMemories(query, filters);
export const recallMemories: typeof impl.recallMemories = (context) => impl.recallMemories(context);
export const countMemories: typeof impl.countMemories = () => impl.countMemories();
