import { describe, expect, it } from "vitest";
import {
  insertEvent,
  listProjects,
  listSessionEvents,
  listSessions,
  openDb,
  upsertProject,
  upsertSession,
  type StoredEventRow,
  type StoredProjectRow,
  type StoredSessionRow
} from "./db.js";

function row(overrides: Partial<StoredEventRow> = {}): StoredEventRow {
  return {
    sessionId: "s1",
    agentId: "main",
    agentType: null,
    hookEventName: "PreToolUse",
    category: "shell",
    toolName: "Bash",
    toolUseId: "tu1",
    target: "ls",
    timestamp: "2026-01-01T00:00:00.000Z",
    previewInput: '{"command":"ls"}',
    previewOutput: null,
    rawJson: "{}",
    ...overrides
  };
}

function projectRow(overrides: Partial<StoredProjectRow> = {}): StoredProjectRow {
  return {
    id: "proj-1",
    name: "agent-workshop",
    rootPath: "/repo/agent-workshop",
    worktreeOf: null,
    firstSeen: "2026-01-01T00:00:00.000Z",
    lastSeen: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function sessionRow(overrides: Partial<StoredSessionRow> = {}): StoredSessionRow {
  return {
    id: "s1",
    projectId: "proj-1",
    cwd: "/repo/agent-workshop",
    branch: "main",
    startedAt: "2026-01-01T00:00:00.000Z",
    lastEventAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    ...overrides
  };
}

describe("db events", () => {
  it("round-trips an inserted event", () => {
    const db = openDb(":memory:");
    const id = insertEvent(db, row());
    expect(id).toBeGreaterThan(0);

    const events = listSessionEvents(db, "s1");
    expect(events).toHaveLength(1);
    expect(events[0].toolName).toBe("Bash");
    expect(events[0].previewInput).toBe('{"command":"ls"}');
  });

  it("supports replay pagination with sinceId and limit", () => {
    const db = openDb(":memory:");
    const id1 = insertEvent(db, row({ toolUseId: "tu1" }));
    insertEvent(db, row({ toolUseId: "tu2" }));
    insertEvent(db, row({ toolUseId: "tu3" }));

    const page = listSessionEvents(db, "s1", { sinceId: id1, limit: 1 });
    expect(page).toHaveLength(1);
    expect(page[0].toolUseId).toBe("tu2");
  });
});

describe("db projects", () => {
  it("inserts a new project and upserts on conflict without clobbering first_seen", () => {
    const db = openDb(":memory:");
    upsertProject(db, projectRow({ firstSeen: "2026-01-01T00:00:00.000Z", lastSeen: "2026-01-01T00:00:00.000Z" }));
    upsertProject(db, projectRow({ firstSeen: "2026-01-02T00:00:00.000Z", lastSeen: "2026-01-02T00:00:00.000Z" }));

    const projects = listProjects(db);
    expect(projects).toHaveLength(1);
    expect(projects[0].firstSeen).toBe("2026-01-01T00:00:00.000Z");
    expect(projects[0].lastSeen).toBe("2026-01-02T00:00:00.000Z");
  });

  it("stores worktreeOf", () => {
    const db = openDb(":memory:");
    upsertProject(db, projectRow({ id: "proj-wt", worktreeOf: "agent-workshop" }));
    expect(listProjects(db).find((p) => p.id === "proj-wt")?.worktreeOf).toBe("agent-workshop");
  });
});

describe("db sessions", () => {
  it("upserts a session and updates status/branch/lastEventAt on conflict", () => {
    const db = openDb(":memory:");
    upsertProject(db, projectRow());
    upsertSession(db, sessionRow({ status: "active", branch: "main" }));
    upsertSession(db, sessionRow({ status: "idle", branch: "feature-x", lastEventAt: "2026-01-01T00:05:00.000Z" }));

    const sessions = listSessions(db);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("idle");
    expect(sessions[0].branch).toBe("feature-x");
    expect(sessions[0].lastEventAt).toBe("2026-01-01T00:05:00.000Z");
  });

  it("lists sessions joined with their event count", () => {
    const db = openDb(":memory:");
    upsertProject(db, projectRow());
    upsertSession(db, sessionRow());
    insertEvent(db, row({ sessionId: "s1" }));
    insertEvent(db, row({ sessionId: "s1", toolUseId: "tu2" }));

    const sessions = listSessions(db);
    expect(sessions[0].eventCount).toBe(2);
  });

  it("includes sessions with zero events", () => {
    const db = openDb(":memory:");
    upsertProject(db, projectRow());
    upsertSession(db, sessionRow());

    const sessions = listSessions(db);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].eventCount).toBe(0);
  });
});
