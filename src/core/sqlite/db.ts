import Database from "better-sqlite3";
import path from "path";

import { DATA_DIR } from "../utils.js";

const DB_PATH = path.join(DATA_DIR, "db.sqlite");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- ── Memories ──────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS memories (
      id          TEXT PRIMARY KEY,
      user        TEXT NOT NULL,
      device      TEXT NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      scope       TEXT NOT NULL,
      projectPath TEXT,
      filePath    TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      expiresAt   TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user_scope
      ON memories (user, scope, projectPath, filePath);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      id       UNINDEXED,
      title,
      content,
      tokenize = 'unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(id, title, content)
        VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      DELETE FROM memories_fts WHERE id = old.id;
      INSERT INTO memories_fts(id, title, content)
        VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memories_fts WHERE id = old.id;
    END;

    -- ── Snippets ──────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS snippets (
      id        TEXT PRIMARY KEY,
      user      TEXT NOT NULL,
      device    TEXT NOT NULL,
      title     TEXT NOT NULL,
      content   TEXT NOT NULL,
      type      TEXT NOT NULL,
      language  TEXT,
      tags      TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
      id       UNINDEXED,
      title,
      content,
      tokenize = 'unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS snippets_ai AFTER INSERT ON snippets BEGIN
      INSERT INTO snippets_fts(id, title, content)
        VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS snippets_au AFTER UPDATE ON snippets BEGIN
      DELETE FROM snippets_fts WHERE id = old.id;
      INSERT INTO snippets_fts(id, title, content)
        VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS snippets_ad AFTER DELETE ON snippets BEGIN
      DELETE FROM snippets_fts WHERE id = old.id;
    END;

    -- ── Agents ────────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS agents (
      id                 TEXT PRIMARY KEY,
      user               TEXT NOT NULL,
      device             TEXT NOT NULL,
      name               TEXT NOT NULL,
      description        TEXT NOT NULL,
      systemPrompt       TEXT NOT NULL,
      model              TEXT,
      tools              TEXT NOT NULL DEFAULT '[]',
      permission         TEXT NOT NULL DEFAULT 'read-only',
      permissionExpiresAt TEXT,
      tags               TEXT NOT NULL DEFAULT '[]',
      createdAt          TEXT NOT NULL,
      updatedAt          TEXT NOT NULL
    );
  `);
}
