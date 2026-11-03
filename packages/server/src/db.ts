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

export interface ProjectNotesRow {
  projectId: string;
  notes: string;
  updatedAt: string;
}

export interface SessionRecapRow {
  sessionId: string;
  recap: string;
  model: string | null;
  generatedAt: string;
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

CREATE TABLE IF NOT EXISTS project_notes (
  project_id TEXT PRIMARY KEY,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_recaps (
  session_id TEXT PRIMARY KEY,
  recap TEXT NOT NULL,
  model TEXT,
  generated_at TEXT NOT NULL
);
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

export function getProjectNotes(db: DatabaseSync, projectId: string): ProjectNotesRow | null {
  const row = db.prepare(`SELECT * FROM project_notes WHERE project_id = ?`).get(projectId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return { projectId: row.project_id as string, notes: row.notes as string, updatedAt: row.updated_at as string };
}

export function upsertProjectNotes(db: DatabaseSync, projectId: string, notes: string, updatedAt: string): void {
  db.prepare(
    `INSERT INTO project_notes (project_id, notes, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at`
  ).run(projectId, notes, updatedAt);
}

export function getSessionRecap(db: DatabaseSync, sessionId: string): SessionRecapRow | null {
  const row = db.prepare(`SELECT * FROM session_recaps WHERE session_id = ?`).get(sessionId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    sessionId: row.session_id as string,
    recap: row.recap as string,
    model: (row.model as string | null) ?? null,
    generatedAt: row.generated_at as string
  };
}

export function upsertSessionRecap(db: DatabaseSync, row: SessionRecapRow): void {
  db.prepare(
    `INSERT INTO session_recaps (session_id, recap, model, generated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET recap = excluded.recap, model = excluded.model, generated_at = excluded.generated_at`
  ).run(row.sessionId, row.recap, row.model, row.generatedAt);
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

export interface SearchResultRow extends EventRecord {
  projectId: string;
}

/** Plain LIKE search across target/preview/tool_name — not FTS5. This is a
 *  local personal tool at modest data volume; a substring scan is simple and
 *  fast enough. Revisit with FTS5 only if it ever actually gets slow. */
export function searchEvents(
  db: DatabaseSync,
  options: { q: string; projectId?: string; limit?: number }
): SearchResultRow[] {
  const limit = options.limit ?? 200;
  const like = `%${options.q}%`;
  const projectId = options.projectId ?? null;
  const rows = db
    .prepare(
      `SELECT e.*, s.project_id AS project_id FROM events e
       JOIN sessions s ON s.id = e.session_id
       WHERE (e.target LIKE ? OR e.preview_input LIKE ? OR e.preview_output LIKE ? OR e.tool_name LIKE ?)
         AND (? IS NULL OR s.project_id = ?)
       ORDER BY e.timestamp DESC
       LIMIT ?`
    )
    .all(like, like, like, like, projectId, projectId, limit) as Array<Record<string, unknown>>;
  return rows.map((row) => ({ ...toEventRecord(row), projectId: row.project_id as string }));
}

/** Delete all history except events belonging to the given session IDs. */
export function clearHistory(db: DatabaseSync, keepSessionIds: string[] = []): { deletedEvents: number; deletedSessions: number; deletedProjects: number } {
  if (keepSessionIds.length > 0) {
    const placeholders = keepSessionIds.map(() => "?").join(",");
    const evtResult = db.prepare(`DELETE FROM events WHERE session_id NOT IN (${placeholders})`).run(...keepSessionIds);
    db.prepare(`DELETE FROM session_recaps WHERE session_id NOT IN (${placeholders})`).run(...keepSessionIds);
    const sessResult = db.prepare(`DELETE FROM sessions WHERE id NOT IN (${placeholders})`).run(...keepSessionIds);
    // Delete orphan projects that have no remaining sessions
    const projResult = db.prepare(`DELETE FROM projects WHERE id NOT IN (SELECT DISTINCT project_id FROM sessions)`).run();
    db.prepare(`DELETE FROM project_notes WHERE project_id NOT IN (SELECT id FROM projects)`).run();
    return {
      deletedEvents: Number(evtResult.changes),
      deletedSessions: Number(sessResult.changes),
      deletedProjects: Number(projResult.changes)
    };
  }
  const evtResult = db.prepare(`DELETE FROM events`).run();
  const sessResult = db.prepare(`DELETE FROM sessions`).run();
  const projResult = db.prepare(`DELETE FROM projects`).run();
  db.prepare(`DELETE FROM project_notes`).run();
  db.prepare(`DELETE FROM session_recaps`).run();
  return {
    deletedEvents: Number(evtResult.changes),
    deletedSessions: Number(sessResult.changes),
    deletedProjects: Number(projResult.changes)
  };
}

/** Purge events, sessions, and projects older than `maxAgeMs` from now.
 *  Returns the count of deleted events. Called on startup to prevent stale
 *  sessions from prior days from showing up when someone starts the server. */
export function purgeOldData(db: DatabaseSync, maxAgeMs: number): number {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  // Delete old events
  const evtResult = db.prepare(`DELETE FROM events WHERE timestamp < ?`).run(cutoff);
  // Delete old sessions that have no remaining events
  db.prepare(`DELETE FROM sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM events)`).run();
  // Delete orphan recaps
  db.prepare(`DELETE FROM session_recaps WHERE session_id NOT IN (SELECT id FROM sessions)`).run();
  // Delete orphan projects
  db.prepare(`DELETE FROM projects WHERE id NOT IN (SELECT DISTINCT project_id FROM sessions)`).run();
  db.prepare(`DELETE FROM project_notes WHERE project_id NOT IN (SELECT id FROM projects)`).run();
  return Number(evtResult.changes);
}

/** Returns all stored events ordered by id (insertion order), for replay.
 *  Only the raw_json column is needed — the model re-derives everything. */
export function listAllEventsRaw(db: DatabaseSync): Array<{ rawJson: string }> {
  const rows = db
    .prepare(`SELECT raw_json FROM events ORDER BY id ASC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ rawJson: row.raw_json as string }));
}
