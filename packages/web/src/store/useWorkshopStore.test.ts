import { beforeEach, describe, expect, it } from "vitest";
import type { SerializedAgent, SerializedProject, SerializedSession, WorkshopEvent } from "@agent-workshop/shared";
import { useWorkshopStore } from "./useWorkshopStore.js";

function agent(overrides: Partial<SerializedAgent> = {}): SerializedAgent {
  return {
    id: "main",
    sessionId: "s1",
    parentAgentId: null,
    correlation: null,
    agentType: null,
    taskDescription: null,
    state: { lifecycle: "idle", category: null, lastError: null, updatedAt: "T0" },
    presence: "active",
    mood: "sleepy",
    consecutiveErrors: 0,
    lastEventAt: "T0",
    activeToolCalls: [],
    finishedToolCalls: [],
    ...overrides
  };
}

function project(overrides: Partial<SerializedProject> = {}): SerializedProject {
  return {
    id: "proj-1",
    name: "agent-workshop",
    rootPath: "/repo/agent-workshop",
    worktreeOf: null,
    firstSeen: "T0",
    lastSeen: "T0",
    ...overrides
  };
}

function session(overrides: Partial<SerializedSession> = {}): SerializedSession {
  return {
    id: "s1",
    projectId: "proj-1",
    cwd: null,
    branch: null,
    startedAt: "T0",
    lastEventAt: "T0",
    status: "active",
    agents: [],
    ...overrides
  };
}

function event(overrides: Partial<WorkshopEvent> = {}): WorkshopEvent {
  return {
    sessionId: "s1",
    agentId: "main",
    agentType: null,
    hookEventName: "PreToolUse",
    category: "shell",
    toolName: "Bash",
    toolUseId: "tu1",
    target: "ls",
    timestamp: "T0",
    raw: {} as WorkshopEvent["raw"],
    ...overrides
  };
}

describe("useWorkshopStore", () => {
  beforeEach(() => {
    useWorkshopStore.setState({
      status: "connecting",
      projects: {},
      sessions: {},
      activeSessionId: null,
      projectFilter: null,
      focusedSessionId: null,
      timeline: []
    });
  });

  it("applySnapshot indexes projects and sessions by id, and picks an active session", () => {
    const s = session({ agents: [agent()] });
    useWorkshopStore.getState().applySnapshot({ projects: [project()], sessions: [s] });
    const state = useWorkshopStore.getState();
    expect(state.sessions.s1).toEqual(s);
    expect(state.projects["proj-1"]).toEqual(project());
    expect(state.activeSessionId).toBe("s1");
  });

  it("applyEvent creates the session and project if they don't exist yet, and appends to the timeline", () => {
    useWorkshopStore.getState().applyEvent(event(), project(), agent());
    const state = useWorkshopStore.getState();
    expect(state.sessions.s1.agents).toHaveLength(1);
    expect(state.projects["proj-1"]).toEqual(project());
    expect(state.timeline).toHaveLength(1);
    expect(state.activeSessionId).toBe("s1");
  });

  it("applyEvent upserts an agent by id rather than duplicating it", () => {
    useWorkshopStore
      .getState()
      .applyEvent(event(), project(), agent({ state: { lifecycle: "working", category: "shell", lastError: null, updatedAt: "T0" } }));
    useWorkshopStore
      .getState()
      .applyEvent(event({ timestamp: "T1" }), project(), agent({ state: { lifecycle: "idle", category: null, lastError: null, updatedAt: "T1" } }));

    const state = useWorkshopStore.getState();
    expect(state.sessions.s1.agents).toHaveLength(1);
    expect(state.sessions.s1.agents[0].state.lifecycle).toBe("idle");
    expect(state.timeline).toHaveLength(2);
  });

  it("applyAgentUpdate is a no-op when the session doesn't exist yet", () => {
    useWorkshopStore.getState().applyAgentUpdate("unknown-session", "main", agent());
    expect(useWorkshopStore.getState().sessions["unknown-session"]).toBeUndefined();
  });

  it("applyAgentUpdate updates an existing agent in place", () => {
    useWorkshopStore.getState().applyEvent(event(), project(), agent());
    useWorkshopStore.getState().applyAgentUpdate("s1", "main", agent({ presence: "stale" }));
    expect(useWorkshopStore.getState().sessions.s1.agents[0].presence).toBe("stale");
  });

  it("applySessionUpdate replaces the session record (e.g. a status sweep)", () => {
    useWorkshopStore.getState().applyEvent(event(), project(), agent());
    useWorkshopStore.getState().applySessionUpdate("s1", session({ status: "ended" }));
    expect(useWorkshopStore.getState().sessions.s1.status).toBe("ended");
  });

  it("setActiveSession switches which session is active", () => {
    useWorkshopStore.getState().applySnapshot({ projects: [project()], sessions: [session({ id: "s1" }), session({ id: "s2" })] });
    useWorkshopStore.getState().setActiveSession("s2");
    expect(useWorkshopStore.getState().activeSessionId).toBe("s2");
  });

  it("setProjectFilter and setFocusedSession update their fields", () => {
    useWorkshopStore.getState().setProjectFilter("proj-1");
    expect(useWorkshopStore.getState().projectFilter).toBe("proj-1");
    useWorkshopStore.getState().setFocusedSession("s1");
    expect(useWorkshopStore.getState().focusedSessionId).toBe("s1");
  });
});
