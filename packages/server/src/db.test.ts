import { describe, expect, it } from "vitest";
import {
  getProjectNotes,
  getSessionRecap,
  insertEvent,
  listProjects,
  listSessionEvents,
  listSessions,
  openDb,
  searchEvents,
  upsertProject,
  upsertProjectNotes,
  upsertSession,
  upsertSessionRecap,
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

describe("searchEvents", () => {
  function seed(db: ReturnType<typeof openDb>) {
    upsertProject(db, projectRow({ id: "proj-1" }));
    upsertProject(db, projectRow({ id: "proj-2", name: "other-repo" }));
    upsertSession(db, sessionRow({ id: "s1", projectId: "proj-1" }));
    upsertSession(db, sessionRow({ id: "s2", projectId: "proj-2" }));
    insertEvent(db, row({ sessionId: "s1", target: "grep -rn foo src/", timestamp: "2026-01-01T00:00:01.000Z" }));
    insertEvent(db, row({ sessionId: "s1", target: "ls -la", timestamp: "2026-01-01T00:00:02.000Z" }));
    insertEvent(db, row({ sessionId: "s2", target: "grep -rn foo lib/", timestamp: "2026-01-01T00:00:03.000Z" }));
  }

  it("matches on the target column across all projects", () => {
    const db = openDb(":memory:");
    seed(db);
    const results = searchEvents(db, { q: "foo" });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.sessionId).sort()).toEqual(["s1", "s2"]);
  });

  it("filters by projectId when provided", () => {
    const db = openDb(":memory:");
    seed(db);
    const results = searchEvents(db, { q: "foo", projectId: "proj-1" });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("s1");
  });

  it("returns newest-first", () => {
    const db = openDb(":memory:");
    seed(db);
    const results = searchEvents(db, { q: "grep" });
    expect(results[0].sessionId).toBe("s2");
    expect(results[1].sessionId).toBe("s1");
  });

  it("returns nothing for a non-matching query", () => {
    const db = openDb(":memory:");
    seed(db);
    expect(searchEvents(db, { q: "nonexistent" })).toHaveLength(0);
  });
});

describe("db session recaps", () => {
  it("returns null for a session with no recap yet", () => {
    const db = openDb(":memory:");
    expect(getSessionRecap(db, "s1")).toBeNull();
  });

  it("round-trips a recap", () => {
    const db = openDb(":memory:");
    upsertSessionRecap(db, { sessionId: "s1", recap: "Fixed the Windows hook bug.", model: "claude", generatedAt: "2026-01-01T00:00:00.000Z" });
    expect(getSessionRecap(db, "s1")).toEqual({
      sessionId: "s1",
      recap: "Fixed the Windows hook bug.",
      model: "claude",
      generatedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("overwrites an existing recap on regenerate", () => {
    const db = openDb(":memory:");
    upsertSessionRecap(db, { sessionId: "s1", recap: "first", model: "claude", generatedAt: "2026-01-01T00:00:00.000Z" });
    upsertSessionRecap(db, { sessionId: "s1", recap: "second", model: "claude", generatedAt: "2026-01-02T00:00:00.000Z" });
    expect(getSessionRecap(db, "s1")?.recap).toBe("second");
  });
});

describe("db project notes", () => {
  it("returns null for a project with no notes yet", () => {
    const db = openDb(":memory:");
    expect(getProjectNotes(db, "proj-1")).toBeNull();
  });

  it("round-trips notes for a project", () => {
    const db = openDb(":memory:");
    upsertProjectNotes(db, "proj-1", "working on the hooks fix", "2026-01-01T00:00:00.000Z");
    expect(getProjectNotes(db, "proj-1")).toEqual({
      projectId: "proj-1",
      notes: "working on the hooks fix",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("overwrites existing notes on conflict rather than duplicating rows", () => {
    const db = openDb(":memory:");
    upsertProjectNotes(db, "proj-1", "first draft", "2026-01-01T00:00:00.000Z");
    upsertProjectNotes(db, "proj-1", "revised", "2026-01-02T00:00:00.000Z");
    expect(getProjectNotes(db, "proj-1")).toEqual({
      projectId: "proj-1",
      notes: "revised",
      updatedAt: "2026-01-02T00:00:00.000Z"
    });
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
