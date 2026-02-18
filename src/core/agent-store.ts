import fs from "fs";
import path from "path";

import { logger } from "./logger.js";
import { generateId, getStorePath, isExpired, nowISO, searchMatches, tagsMatch } from "./utils.js";

export type AgentPermission = "read-only" | "read-write";

export type Agent = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  tools: string[];
  permission: AgentPermission;
  permissionExpiresAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CreateAgentInput = {
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  permission?: AgentPermission;
  permissionExpiresAt?: string;
  tags?: string[];
};

type UpdateAgentInput = {
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string | null;
  tools?: string[];
  permission?: AgentPermission;
  permissionExpiresAt?: string | null;
  tags?: string[];
};

type ListAgentFilters = {
  tags?: string[];
};

const STORE_NAME = "agents";

function getFilePath(id: string): string {
  return path.join(getStorePath(STORE_NAME), `${id}.json`);
}

function readAgent(id: string): Agent | null {
  const filePath = getFilePath(id);
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as Agent;
  } catch {
    return null;
  }
}

function writeAgent(agent: Agent): void {
  const filePath = getFilePath(agent.id);
  fs.writeFileSync(filePath, JSON.stringify(agent, null, 2), "utf-8");
}

function getAllAgents(): Agent[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const agents: Agent[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      agents.push(JSON.parse(data) as Agent);
    } catch {
      // Skip corrupted files
    }
  }

  return agents.sort((a, b) => a.id.localeCompare(b.id));
}

function resolvePermission(agent: Agent): Agent {
  // If write permission has expired, revert to read-only
  if (
    agent.permission === "read-write" &&
    agent.permissionExpiresAt &&
    isExpired(agent.permissionExpiresAt)
  ) {
    agent.permission = "read-only";
    delete agent.permissionExpiresAt;
    agent.updatedAt = nowISO();
    writeAgent(agent);
    logger.info(
      "agent-store",
      `Write permission expired for agent: ${agent.id} (${agent.name}), reverted to read-only`,
    );
  }
  return agent;
}

export function createAgent(input: CreateAgentInput): Agent {
  const now = nowISO();
  const agent: Agent = {
    id: generateId(),
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt,
    tools: input.tools ?? [],
    permission: input.permission ?? "read-only",
    permissionExpiresAt: input.permissionExpiresAt,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.model) agent.model = input.model;
  writeAgent(agent);
  logger.info("agent-store", `Created agent: ${agent.id} (${agent.name})`);
  return agent;
}

export function getAgent(id: string): Agent | null {
  const agent = readAgent(id);
  if (!agent) return null;
  return resolvePermission(agent);
}

export function updateAgent(id: string, input: UpdateAgentInput): Agent | null {
  const agent = readAgent(id);
  if (!agent) return null;

  if (input.name !== undefined) agent.name = input.name;
  if (input.description !== undefined) agent.description = input.description;
  if (input.systemPrompt !== undefined) agent.systemPrompt = input.systemPrompt;
  if (input.tools !== undefined) agent.tools = input.tools;
  if (input.permission !== undefined) agent.permission = input.permission;
  if (input.model === null) {
    delete agent.model;
  } else if (input.model !== undefined) {
    agent.model = input.model;
  }
  if (input.permissionExpiresAt === null) {
    delete agent.permissionExpiresAt;
  } else if (input.permissionExpiresAt !== undefined) {
    agent.permissionExpiresAt = input.permissionExpiresAt;
  }
  if (input.tags !== undefined) agent.tags = input.tags;
  agent.updatedAt = nowISO();

  writeAgent(agent);
  logger.info("agent-store", `Updated agent: ${id}`);
  return agent;
}

export function deleteAgent(id: string): boolean {
  const filePath = getFilePath(id);
  try {
    fs.unlinkSync(filePath);
    logger.info("agent-store", `Deleted agent: ${id}`);
    return true;
  } catch {
    return false;
  }
}

export function listAgents(filters: ListAgentFilters = {}): Agent[] {
  let agents = getAllAgents().map(resolvePermission);

  if (filters.tags && filters.tags.length > 0) {
    agents = agents.filter((a) => tagsMatch(a.tags, filters.tags!));
  }

  return agents;
}

export function searchAgents(query: string, filters: ListAgentFilters = {}): Agent[] {
  const agents = listAgents(filters);
  return agents.filter((a) => searchMatches(a.name, query) || searchMatches(a.description, query));
}

export function countAgents(): number {
  const dir = getStorePath(STORE_NAME);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}
