import { describe, expect, it } from "vitest";
import { createInitialAgentState, transitionAgent, type AgentEvent, type AgentState } from "./agent-state.js";

const T = "2026-01-01T00:00:00.000Z";

function at(type: AgentEvent["type"], extra: Partial<AgentEvent> = {}): AgentEvent {
  return { type, at: T, ...extra } as AgentEvent;
}

function fresh(overrides: Partial<AgentState> = {}): AgentState {
  return { ...createInitialAgentState(T), ...overrides };
}

describe("transitionAgent", () => {
  it("starts with every flag clear", () => {
    const state = createInitialAgentState(T);
    expect(state).toEqual({ needsPermission: false, awaitingPrompt: false, done: false, leaving: false, lastError: null, updatedAt: T });
  });

  it("TOOL_STARTED clears needsPermission, awaitingPrompt, and done", () => {
    const state = fresh({ needsPermission: true, awaitingPrompt: true, done: true });
    const next = transitionAgent(state, at("TOOL_STARTED"));
    expect(next.needsPermission).toBe(false);
    expect(next.awaitingPrompt).toBe(false);
    expect(next.done).toBe(false);
  });

  it("PERMISSION_REQUIRED sets needsPermission; next TOOL_STARTED clears it", () => {
    let state = fresh();
    state = transitionAgent(state, at("PERMISSION_REQUIRED"));
    expect(state.needsPermission).toBe(true);

    state = transitionAgent(state, at("TOOL_STARTED"));
    expect(state.needsPermission).toBe(false);
  });

  it("TOOL_FAILED records the error; TOOL_SUCCEEDED clears it", () => {
    let state = fresh();
    state = transitionAgent(state, at("TOOL_FAILED", { error: "boom" }));
    expect(state.lastError).toBe("boom");

    state = transitionAgent(state, at("TOOL_SUCCEEDED"));
    expect(state.lastError).toBeNull();
  });

  it("AWAIT_PROMPT (Stop) sets awaitingPrompt", () => {
    const next = transitionAgent(fresh(), at("AWAIT_PROMPT"));
    expect(next.awaitingPrompt).toBe(true);
  });

  it("PROMPT_SUBMITTED (UserPromptSubmit) clears awaitingPrompt", () => {
    const state = fresh({ awaitingPrompt: true });
    const next = transitionAgent(state, at("PROMPT_SUBMITTED"));
    expect(next.awaitingPrompt).toBe(false);
  });

  it("DONE (SubagentStop/SessionEnd) sets done and clears awaitingPrompt", () => {
    const state = fresh({ awaitingPrompt: true });
    const next = transitionAgent(state, at("DONE"));
    expect(next.done).toBe(true);
    expect(next.awaitingPrompt).toBe(false);
  });

  it("DEPART only takes effect once done, setting leaving", () => {
    const notDone = fresh();
    expect(transitionAgent(notDone, at("DEPART")).leaving).toBe(false);

    const done = fresh({ done: true });
    expect(transitionAgent(done, at("DEPART")).leaving).toBe(true);
  });

  it("leaving is terminal to everything except SPAWNED (resume)", () => {
    const state = fresh({ done: true, leaving: true });
    expect(transitionAgent(state, at("TOOL_STARTED")).leaving).toBe(true);
    expect(transitionAgent(state, at("DEPART")).leaving).toBe(true);
    expect(transitionAgent(state, at("AWAIT_PROMPT")).leaving).toBe(true);
    expect(transitionAgent(state, at("DONE")).leaving).toBe(true);

    const resumed = transitionAgent(state, at("SPAWNED"));
    expect(resumed).toEqual({ needsPermission: false, awaitingPrompt: false, done: false, leaving: false, lastError: null, updatedAt: T });
  });

  it("SPAWNED resumes a done (non-leaving) agent to a fresh state", () => {
    const state = fresh({ done: true });
    const next = transitionAgent(state, at("SPAWNED"));
    expect(next.done).toBe(false);
  });

  it("SPAWNED is a no-op for an agent that's neither done nor leaving", () => {
    const state = fresh({ needsPermission: true });
    const next = transitionAgent(state, at("SPAWNED"));
    expect(next).toBe(state);
  });
});
