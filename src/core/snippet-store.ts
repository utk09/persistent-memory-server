/**
 * Dispatcher: routes to JSON or SQLite backend based on DB_BACKEND env var.
 */
export type {
  CreateSnippetInput,
  ListSnippetFilters,
  Snippet,
  SnippetType,
  UpdateSnippetInput,
} from "./types.js";

import { USE_SQLITE } from "./backend-config.js";
import * as json from "./json/snippet-store.js";
import * as sqlite from "./sqlite/snippet-store.js";

const impl = USE_SQLITE ? sqlite : json;

export const createSnippet: typeof impl.createSnippet = (input) => impl.createSnippet(input);
export const getSnippet: typeof impl.getSnippet = (id) => impl.getSnippet(id);
export const updateSnippet: typeof impl.updateSnippet = (id, input) =>
  impl.updateSnippet(id, input);
export const deleteSnippet: typeof impl.deleteSnippet = (id) => impl.deleteSnippet(id);
export const listSnippets: typeof impl.listSnippets = (filters) => impl.listSnippets(filters);
export const searchSnippets: typeof impl.searchSnippets = (query, filters) =>
  impl.searchSnippets(query, filters);
export const countSnippets: typeof impl.countSnippets = () => impl.countSnippets();
