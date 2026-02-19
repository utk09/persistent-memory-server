// Shared types used by both JSON and SQLite backends.

// ── Memory ──────────────────────────────────────────────────────────────────

export type MemoryScope = "global" | "project" | "file";

export type Memory = {
  id: string;
  user: string;
  device: string;
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

export type CreateMemoryInput = {
  user: string;
  device: string;
  title: string;
  content: string;
  scope: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  expiresAt?: string;
};

export type UpdateMemoryInput = {
  user?: string;
  device?: string;
  title?: string;
  content?: string;
  scope?: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  expiresAt?: string | null; // null to remove expiration
};

export type ListMemoryFilters = {
  user?: string;
  device?: string;
  scope?: MemoryScope;
  projectPath?: string;
  filePath?: string;
  tags?: string[];
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
};

export type RecallContext = {
  user?: string;
  device?: string;
  projectPath: string;
  filePath?: string;
};

export type MemoryRecallResult = Memory & {
  _matchReason: "global" | "project" | "file";
};

// ── Snippet ──────────────────────────────────────────────────────────────────

export type SnippetType = "script" | "snippet" | "template" | "reference" | "tool";

export type Snippet = {
  id: string;
  user: string;
  device: string;
  title: string;
  content: string;
  type: SnippetType;
  language?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateSnippetInput = {
  user: string;
  device: string;
  title: string;
  content: string;
  type: SnippetType;
  language?: string;
  tags?: string[];
};

export type UpdateSnippetInput = {
  user?: string;
  device?: string;
  title?: string;
  content?: string;
  type?: SnippetType;
  language?: string | null;
  tags?: string[];
};

export type ListSnippetFilters = {
  user?: string;
  device?: string;
  type?: SnippetType;
  tags?: string[];
  limit?: number;
  offset?: number;
};

// ── Agent ────────────────────────────────────────────────────────────────────

export type AgentPermission = "read-only" | "read-write";

export type Agent = {
  id: string;
  user: string;
  device: string;
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

export type CreateAgentInput = {
  user: string;
  device: string;
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  permission?: AgentPermission;
  permissionExpiresAt?: string;
  tags?: string[];
};

export type UpdateAgentInput = {
  user?: string;
  device?: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string | null;
  tools?: string[];
  permission?: AgentPermission;
  permissionExpiresAt?: string | null;
  tags?: string[];
};

export type ListAgentFilters = {
  user?: string;
  device?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
};
