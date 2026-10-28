import { describe, expect, it } from "vitest";
import { createInitialAgentState, transitionAgent, type AgentEvent, type AgentState } from "./agent-state.js";

const T = "2026-01-01T00:00:00.000Z";

function at(type: AgentEvent["type"], extra: Partial<AgentEvent> = {}): AgentEvent {
  return { type, at: T, ...extra } as AgentEvent;
}

describe("transitionAgent", () => {
  it("starts in entering", () => {
    const state = createInitialAgentState(T);
    expect(state.lifecycle).toBe("entering");
  });

  it("entering -> working on TOOL_STARTED", () => {
    const state = createInitialAgentState(T);
    const next = transitionAgent(state, at("TOOL_STARTED", { category: "shell" }));
    expect(next.lifecycle).toBe("working");
    expect(next.category).toBe("shell");
  });

  it("idle <-> working on tool start/success", () => {
    let state: AgentState = { lifecycle: "idle", category: null, lastError: null, updatedAt: T };
    state = transitionAgent(state, at("TOOL_STARTED", { category: "read" }));
    expect(state.lifecycle).toBe("working");
    expect(state.category).toBe("read");

    state = transitionAgent(state, at("TOOL_SUCCEEDED"));
    expect(state.lifecycle).toBe("idle");
    expect(state.category).toBeNull();
  });

  it("working -> waiting_permission -> working on resolve", () => {
    let state: AgentState = { lifecycle: "working", category: "shell", lastError: null, updatedAt: T };
    state = transitionAgent(state, at("PERMISSION_REQUIRED"));
    expect(state.lifecycle).toBe("waiting_permission");

    state = transitionAgent(state, at("TOOL_STARTED", { category: "shell" }));
    expect(state.lifecycle).toBe("working");
  });

  it("waiting_permission -> idle on PERMISSION_RESOLVED", () => {
    const state: AgentState = { lifecycle: "waiting_permission", category: "shell", lastError: null, updatedAt: T };
    const next = transitionAgent(state, at("PERMISSION_RESOLVED"));
    expect(next.lifecycle).toBe("idle");
  });

  it("working -> error on TOOL_FAILED, and recovers on next tool start", () => {
    let state: AgentState = { lifecycle: "working", category: "write", lastError: null, updatedAt: T };
    state = transitionAgent(state, at("TOOL_FAILED", { error: "boom" }));
    expect(state.lifecycle).toBe("error");
    expect(state.lastError).toBe("boom");

    state = transitionAgent(state, at("TOOL_STARTED", { category: "write" }));
    expect(state.lifecycle).toBe("working");
    expect(state.lastError).toBeNull();
  });

  it("error -> idle on TOOL_SUCCEEDED", () => {
    const state: AgentState = { lifecycle: "error", category: "write", lastError: "boom", updatedAt: T };
    const next = transitionAgent(state, at("TOOL_SUCCEEDED"));
    expect(next.lifecycle).toBe("idle");
  });

  it("any active state -> done on STOPPED", () => {
    for (const lifecycle of ["entering", "idle", "working", "waiting_permission", "error"] as const) {
      const state: AgentState = { lifecycle, category: null, lastError: null, updatedAt: T };
      const next = transitionAgent(state, at("STOPPED"));
      expect(next.lifecycle).toBe("done");
    }
  });

  it("done -> leaving on DEPART", () => {
    const state: AgentState = { lifecycle: "done", category: null, lastError: null, updatedAt: T };
    const next = transitionAgent(state, at("DEPART"));
    expect(next.lifecycle).toBe("leaving");
  });

  it("leaving is terminal to everything except SPAWNED (resume)", () => {
    const state: AgentState = { lifecycle: "leaving", category: null, lastError: null, updatedAt: T };
    expect(transitionAgent(state, at("TOOL_STARTED", { category: "shell" })).lifecycle).toBe("leaving");
    expect(transitionAgent(state, at("DEPART")).lifecycle).toBe("leaving");
    expect(transitionAgent(state, at("STOPPED")).lifecycle).toBe("leaving");
    expect(transitionAgent(state, at("SPAWNED")).lifecycle).toBe("entering");
  });

  it("done resumes to entering on SPAWNED (SendMessage waking a background subagent)", () => {
    const state: AgentState = { lifecycle: "done", category: null, lastError: null, updatedAt: T };
    const next = transitionAgent(state, at("SPAWNED"));
    expect(next.lifecycle).toBe("entering");
  });

  it("ignores events that don't apply to the current lifecycle", () => {
    const state: AgentState = { lifecycle: "idle", category: null, lastError: null, updatedAt: T };
    expect(transitionAgent(state, at("PERMISSION_RESOLVED")).lifecycle).toBe("idle");
    expect(transitionAgent(state, at("DEPART")).lifecycle).toBe("idle");
  });
});
