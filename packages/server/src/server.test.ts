import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { buildApp } from "./server.js";

function testConfig() {
  return { ...loadConfig(), dbPath: ":memory:", sweepIntervalMs: 60_000 };
}

describe("POST /events", () => {
  it("accepts a valid envelope, stores it, and returns 204", async () => {
    const app = buildApp({ config: testConfig(), db: openDb(":memory:") });
    const res = await app.inject({
      method: "POST",
      url: "/events",
      payload: {
        session_id: "s1",
        hook_event_name: "SessionStart",
        source: "startup",
        timestamp: "2026-01-01T00:00:00.000Z"
      }
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });

  it("rejects a payload missing required common fields", async () => {
    const app = buildApp({ config: testConfig(), db: openDb(":memory:") });
    const res = await app.inject({
      method: "POST",
      url: "/events",
      payload: { hook_event_name: "SessionStart" }
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe("GET /sessions and /sessions/:id/events", () => {
  it("lists sessions and their events after ingestion", async () => {
    const app = buildApp({ config: testConfig(), db: openDb(":memory:") });

    await app.inject({
      method: "POST",
      url: "/events",
      payload: { session_id: "s1", hook_event_name: "SessionStart", source: "startup", timestamp: "T0" }
    });
    await app.inject({
      method: "POST",
      url: "/events",
      payload: {
        session_id: "s1",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_use_id: "tu1",
        timestamp: "T1"
      }
    });

    const sessionsRes = await app.inject({ method: "GET", url: "/sessions" });
    expect(sessionsRes.statusCode).toBe(200);
    const sessions = sessionsRes.json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("s1");
    expect(sessions[0].eventCount).toBe(2);
    expect(typeof sessions[0].projectId).toBe("string");

    const eventsRes = await app.inject({ method: "GET", url: "/sessions/s1/events" });
    const events = eventsRes.json();
    expect(events).toHaveLength(2);
    expect(events[1].toolName).toBe("Bash");

    await app.close();
  });
});

describe("GET /projects", () => {
  it("lists the project a session's cwd resolved to", async () => {
    const app = buildApp({ config: testConfig(), db: openDb(":memory:") });

    await app.inject({
      method: "POST",
      url: "/events",
      payload: { session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/repo/agent-workshop", timestamp: "T0" }
    });

    const res = await app.inject({ method: "GET", url: "/projects" });
    const projects = res.json();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("agent-workshop");

    await app.close();
  });
});

describe("WebSocket snapshot + broadcast", () => {
  it("sends a snapshot on connect and broadcasts subsequent events", async () => {
    const app = buildApp({ config: testConfig(), db: openDb(":memory:") });
    await app.ready();

    const ws = await app.injectWS("/ws");
    const firstMessage = await new Promise<string>((resolve) => {
      ws.once("message", (data: Buffer) => resolve(data.toString()));
    });
    const snapshot = JSON.parse(firstMessage);
    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.payload).toEqual({ projects: [], sessions: [] });

    const nextMessage = new Promise<string>((resolve) => {
      ws.once("message", (data: Buffer) => resolve(data.toString()));
    });

    await app.inject({
      method: "POST",
      url: "/events",
      payload: { session_id: "s1", hook_event_name: "SessionStart", source: "startup", timestamp: "T0" }
    });

    const broadcast = JSON.parse(await nextMessage);
    expect(broadcast.type).toBe("event");
    expect(broadcast.payload.sessionId).toBe("s1");

    ws.terminate();
    await app.close();
  });
});
