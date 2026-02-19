import fs from "fs";
import path from "path";

import { logger } from "./logger.js";
import { generateId, getStorePath, nowISO } from "./utils.js";

export type SessionTransport = "streamable-http" | "sse" | "stdio";

export type Session = {
  id: string;
  sessionId: string; // MCP transport session ID
  user: string; // from X-User-Id header (or MCP_USER env, or "anonymous")
  device: string; // from X-Device-Name header (or MCP_DEVICE env, or "unknown")
  transport: SessionTransport;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
};

type CreateSessionInput = {
  sessionId: string;
  user: string;
  device: string;
  transport: SessionTransport;
  ipAddress?: string;
};

const STORE_NAME = "sessions";

function getFilePath(id: string): string {
  return path.join(getStorePath(STORE_NAME), `${id}.json`);
}

function readSession(id: string): Session | null {
  const filePath = getFilePath(id);
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

function writeSession(session: Session): void {
  const filePath = getFilePath(session.id);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
}

function getAllSessions(): Session[] {
  const dir = getStorePath(STORE_NAME);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const sessions: Session[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      sessions.push(JSON.parse(data) as Session);
    } catch {
      // Skip corrupted files
    }
  }

  // Sort newest first
  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createSession(input: CreateSessionInput): Session {
  const now = nowISO();
  const session: Session = {
    id: generateId(),
    sessionId: input.sessionId,
    user: input.user,
    device: input.device,
    transport: input.transport,
    ipAddress: input.ipAddress,
    createdAt: now,
    updatedAt: now,
  };

  writeSession(session);
  logger.info(
    "session-store",
    `Session created: ${session.sessionId} (${session.user}@${session.device}, ${session.transport})`,
  );
  return session;
}

export function closeSession(sessionId: string): Session | null {
  const sessions = getAllSessions();
  const session = sessions.find((s) => s.sessionId === sessionId && !s.closedAt);
  if (!session) return null;

  session.closedAt = nowISO();
  session.updatedAt = session.closedAt;
  writeSession(session);
  logger.info(
    "session-store",
    `Session closed: ${session.sessionId} (${session.user}@${session.device})`,
  );
  return session;
}

export function updateSessionActivity(sessionId: string): void {
  const sessions = getAllSessions();
  const session = sessions.find((s) => s.sessionId === sessionId && !s.closedAt);
  if (!session) return;

  session.updatedAt = nowISO();
  writeSession(session);
}

export function getSessionByMcpId(sessionId: string): Session | null {
  const sessions = getAllSessions();
  return sessions.find((s) => s.sessionId === sessionId) ?? null;
}

export function getSession(id: string): Session | null {
  return readSession(id);
}

export function listSessions(
  filters: { user?: string; device?: string; active?: boolean } = {},
): Session[] {
  let sessions = getAllSessions();

  if (filters.user) {
    sessions = sessions.filter((s) => s.user === filters.user);
  }

  if (filters.device) {
    sessions = sessions.filter((s) => s.device === filters.device);
  }

  if (filters.active === true) {
    sessions = sessions.filter((s) => !s.closedAt);
  } else if (filters.active === false) {
    sessions = sessions.filter((s) => !!s.closedAt);
  }

  return sessions;
}

export function countSessions(): number {
  const dir = getStorePath(STORE_NAME);
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

export function countActiveSessions(): number {
  return getAllSessions().filter((s) => !s.closedAt).length;
}
