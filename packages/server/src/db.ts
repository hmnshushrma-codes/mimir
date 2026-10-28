import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

// `import ... from "node:sqlite"` as a value import trips up Vite's import
// analyzer (it strips the "node:" prefix and tries to resolve a package
// literally named "sqlite", which doesn't exist) under Vitest. Loading it via
// a CJS require is invisible to that static analysis and works identically
// at runtime, in both tsx and a built Node process.
const { DatabaseSync: DatabaseSyncImpl } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export interface StoredEventRow {
  sessionId: string;
  agentId: string;
  agentType: string | null;
  hookEventName: string;
  category: string;
  toolName: string | null;
  toolUseId: string | null;
  target: string | null;
  timestamp: string;
  previewInput: string | null;
  previewOutput: string | null;
  rawJson: string;
}

export interface EventRecord extends StoredEventRow {
  id: number;
}

export interface StoredProjectRow {
  id: string;
  name: string;
  rootPath: string;
  worktreeOf: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface StoredSessionRow {
  id: string;
  projectId: string;
  cwd: string | null;
  branch: string | null;
  startedAt: string;
  lastEventAt: string;
  status: string;
}

export interface SessionSummary extends StoredSessionRow {
  eventCount: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT,
  hook_event_name TEXT NOT NULL,
  category TEXT NOT NULL,
  tool_name TEXT,
  tool_use_id TEXT,
  target TEXT,
  timestamp TEXT NOT NULL,
  preview_input TEXT,
  preview_output TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_id, id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  worktree_of TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cwd TEXT,
  branch TEXT,
  started_at TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_id);
`;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSyncImpl(path);
  db.exec(SCHEMA);
  return db;
}

export function insertEvent(db: DatabaseSync, row: StoredEventRow): number {
  const stmt = db.prepare(`
    INSERT INTO events
      (session_id, agent_id, agent_type, hook_event_name, category, tool_name, tool_use_id, target, timestamp, preview_input, preview_output, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    row.sessionId,
    row.agentId,
    row.agentType,
    row.hookEventName,
    row.category,
    row.toolName,
    row.toolUseId,
    row.target,
    row.timestamp,
    row.previewInput,
    row.previewOutput,
    row.rawJson
  );
  return Number(result.lastInsertRowid);
}

export function upsertProject(db: DatabaseSync, row: StoredProjectRow): void {
  db.prepare(
    `INSERT INTO projects (id, name, root_path, worktree_of, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen`
  ).run(row.id, row.name, row.rootPath, row.worktreeOf, row.firstSeen, row.lastSeen);
}

export function upsertSession(db: DatabaseSync, row: StoredSessionRow): void {
  db.prepare(
    `INSERT INTO sessions (id, project_id, cwd, branch, started_at, last_event_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cwd = excluded.cwd,
       branch = excluded.branch,
       last_event_at = excluded.last_event_at,
       status = excluded.status`
  ).run(row.id, row.projectId, row.cwd, row.branch, row.startedAt, row.lastEventAt, row.status);
}

export function listProjects(db: DatabaseSync): StoredProjectRow[] {
  const rows = db.prepare(`SELECT * FROM projects ORDER BY last_seen DESC`).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    rootPath: row.root_path as string,
    worktreeOf: (row.worktree_of as string | null) ?? null,
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string
  }));
}

function toEventRecord(row: Record<string, unknown>): EventRecord {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    agentId: row.agent_id as string,
    agentType: (row.agent_type as string | null) ?? null,
    hookEventName: row.hook_event_name as string,
    category: row.category as string,
    toolName: (row.tool_name as string | null) ?? null,
    toolUseId: (row.tool_use_id as string | null) ?? null,
    target: (row.target as string | null) ?? null,
    timestamp: row.timestamp as string,
    previewInput: (row.preview_input as string | null) ?? null,
    previewOutput: (row.preview_output as string | null) ?? null,
    rawJson: row.raw_json as string
  };
}

export function listSessions(db: DatabaseSync): SessionSummary[] {
  const rows = db
    .prepare(
      `SELECT s.*, COUNT(e.id) AS event_count
       FROM sessions s
       LEFT JOIN events e ON e.session_id = s.id
       GROUP BY s.id
       ORDER BY s.last_event_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    cwd: (row.cwd as string | null) ?? null,
    branch: (row.branch as string | null) ?? null,
    startedAt: row.started_at as string,
    lastEventAt: row.last_event_at as string,
    status: row.status as string,
    eventCount: row.event_count as number
  }));
}

export function listSessionEvents(
  db: DatabaseSync,
  sessionId: string,
  options: { sinceId?: number; limit?: number } = {}
): EventRecord[] {
  const limit = options.limit ?? 1000;
  const sinceId = options.sinceId ?? 0;
  const rows = db
    .prepare(`SELECT * FROM events WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT ?`)
    .all(sessionId, sinceId, limit) as Array<Record<string, unknown>>;
  return rows.map(toEventRecord);
}

/** Returns all stored events ordered by id (insertion order), for replay.
 *  Only the raw_json column is needed — the model re-derives everything. */
export function listAllEventsRaw(db: DatabaseSync): Array<{ rawJson: string }> {
  const rows = db
    .prepare(`SELECT raw_json FROM events ORDER BY id ASC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ rawJson: row.raw_json as string }));
}
