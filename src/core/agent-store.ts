/**
 * Dispatcher: routes to JSON or SQLite backend based on DB_BACKEND env var.
 */
export type {
  Agent,
  AgentPermission,
  CreateAgentInput,
  ListAgentFilters,
  UpdateAgentInput,
} from "./types.js";

import { USE_SQLITE } from "./backend-config.js";
import * as json from "./json/agent-store.js";
import * as sqlite from "./sqlite/agent-store.js";

const impl = USE_SQLITE ? sqlite : json;

export const createAgent: typeof impl.createAgent = (input) => impl.createAgent(input);
export const getAgent: typeof impl.getAgent = (id) => impl.getAgent(id);
export const updateAgent: typeof impl.updateAgent = (id, input) => impl.updateAgent(id, input);
export const deleteAgent: typeof impl.deleteAgent = (id) => impl.deleteAgent(id);
export const listAgents: typeof impl.listAgents = (filters) => impl.listAgents(filters);
export const searchAgents: typeof impl.searchAgents = (query, filters) =>
  impl.searchAgents(query, filters);
export const countAgents: typeof impl.countAgents = () => impl.countAgents();
