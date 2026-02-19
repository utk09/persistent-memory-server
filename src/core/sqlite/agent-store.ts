import { logger } from "../logger.js";
import {
  type Agent,
  type AgentPermission,
  type CreateAgentInput,
  type ListAgentFilters,
  type UpdateAgentInput,
} from "../types.js";
import { generateId, isExpired, nowISO, tagsMatch } from "../utils.js";
import { getDb } from "./db.js";

// ── Row mapping ───────────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  user: string;
  device: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string | null;
  tools: string;
  permission: string;
  permissionExpiresAt: string | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    user: row.user,
    device: row.device,
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    model: row.model ?? undefined,
    tools: JSON.parse(row.tools) as string[],
    permission: row.permission as AgentPermission,
    permissionExpiresAt: row.permissionExpiresAt ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Permission resolution ─────────────────────────────────────────────────────

function resolvePermission(agent: Agent): Agent {
  if (
    agent.permission === "read-write" &&
    agent.permissionExpiresAt &&
    isExpired(agent.permissionExpiresAt)
  ) {
    agent.permission = "read-only";
    delete agent.permissionExpiresAt;
    agent.updatedAt = nowISO();

    const db = getDb();
    db.prepare(
      "UPDATE agents SET permission = 'read-only', permissionExpiresAt = NULL, updatedAt = ? WHERE id = ?",
    ).run(agent.updatedAt, agent.id);

    logger.info(
      "agent-store",
      `Write permission expired for agent: ${agent.id} (${agent.name}), reverted to read-only`,
    );
  }
  return agent;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createAgent(input: CreateAgentInput): Agent {
  const db = getDb();
  const now = nowISO();
  const agent: Agent = {
    id: generateId(),
    user: input.user,
    device: input.device,
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt,
    model: input.model,
    tools: input.tools ?? [],
    permission: input.permission ?? "read-only",
    permissionExpiresAt: input.permissionExpiresAt,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `
    INSERT INTO agents (id, user, device, name, description, systemPrompt, model, tools, permission, permissionExpiresAt, tags, createdAt, updatedAt)
    VALUES (@id, @user, @device, @name, @description, @systemPrompt, @model, @tools, @permission, @permissionExpiresAt, @tags, @createdAt, @updatedAt)
  `,
  ).run({
    ...agent,
    model: agent.model ?? null,
    permissionExpiresAt: agent.permissionExpiresAt ?? null,
    tools: JSON.stringify(agent.tools),
    tags: JSON.stringify(agent.tags),
  });

  logger.info("agent-store", `Created agent: ${agent.id} (${agent.name})`);
  return agent;
}

export function getAgent(id: string): Agent | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
  if (!row) return null;
  return resolvePermission(rowToAgent(row));
}

export function updateAgent(id: string, input: UpdateAgentInput): Agent | null {
  const agent = getAgent(id);
  if (!agent) return null;

  if (input.user !== undefined) agent.user = input.user;
  if (input.device !== undefined) agent.device = input.device;
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

  const db = getDb();
  db.prepare(
    `
    UPDATE agents SET
      user = @user, device = @device, name = @name, description = @description,
      systemPrompt = @systemPrompt, model = @model, tools = @tools,
      permission = @permission, permissionExpiresAt = @permissionExpiresAt,
      tags = @tags, updatedAt = @updatedAt
    WHERE id = @id
  `,
  ).run({
    id: agent.id,
    user: agent.user,
    device: agent.device,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    model: agent.model ?? null,
    tools: JSON.stringify(agent.tools),
    permission: agent.permission,
    permissionExpiresAt: agent.permissionExpiresAt ?? null,
    tags: JSON.stringify(agent.tags),
    updatedAt: agent.updatedAt,
  });

  logger.info("agent-store", `Updated agent: ${id}`);
  return agent;
}

export function deleteAgent(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM agents WHERE id = ?").run(id);
  if (result.changes > 0) {
    logger.info("agent-store", `Deleted agent: ${id}`);
    return true;
  }
  return false;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function listAgents(filters: ListAgentFilters = {}): Agent[] {
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let agents = (db.prepare(`SELECT * FROM agents ${where} ORDER BY id`).all(params) as AgentRow[])
    .map(rowToAgent)
    .map(resolvePermission);

  if (filters.tags && filters.tags.length > 0) {
    agents = agents.filter((a) => tagsMatch(a.tags, filters.tags!));
  }

  if (filters.offset) agents = agents.slice(filters.offset);
  if (filters.limit) agents = agents.slice(0, filters.limit);

  return agents;
}

export function searchAgents(query: string, filters: ListAgentFilters = {}): Agent[] {
  // Agents don't have an FTS table — search name + description in-process
  const { limit, offset, ...listFilters } = filters;
  const agents = listAgents(listFilters);

  if (!query.trim()) {
    let paged = agents;
    if (offset) paged = paged.slice(offset);
    if (limit) paged = paged.slice(0, limit);
    return paged;
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let results = agents.filter((a) => {
    const haystack = `${a.name} ${a.description}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });

  if (offset) results = results.slice(offset);
  if (limit) results = results.slice(0, limit);
  return results;
}

export function countAgents(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM agents").get() as { count: number };
  return row.count;
}
