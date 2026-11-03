/**
 * Sticky, event-driven facts about an agent. This is deliberately NOT a
 * single-value lifecycle enum — the ten display states in
 * docs/agent-states.md don't map cleanly onto one axis (e.g. `supervising`
 * and `thinking` both describe "no open tool call", distinguished only by
 * whether subagents are running, which lives on the session, not here).
 * `display-state.ts` combines these flags with facts from `AgentRecord`
 * (activeToolCalls, consecutiveErrors, lastEventAt) to compute the actual
 * display state — this file only tracks what an event-driven reducer can
 * know about in isolation.
 */
export interface AgentState {
  /** Set by a Notification(permission_prompt); cleared by the next tool call
   *  starting. See docs/agent-states.md "Open gap" — there's no dedicated
   *  resolution hook event today. */
  needsPermission: boolean;
  /** Foreman only, by construction: only the `Stop` hook event sets this
   *  (subagents get `SubagentStop`, which sets `done` instead). Cleared by
   *  the next `UserPromptSubmit`. */
  awaitingPrompt: boolean;
  /** Terminal-ish: set by `SubagentStop` (subagent) or `SessionEnd`. Cleared
   *  only by a `SPAWNED` re-entry (rare agent-id reuse / background wake). */
  done: boolean;
  /** Departure-animation flag — unrelated to display state, drives the
   *  desk "walk off" animation via WorkshopModel.sweepDepartures. Terminal
   *  to every event except SPAWNED. */
  leaving: boolean;
  lastError: string | null;
  /** Stamped on every flag change. Needed so sweepDepartures knows how long
   *  `done` has been true, independent of `AgentRecord.lastEventAt` (which
   *  updates on every event, not just state-changing ones). */
  updatedAt: string;
}

export type AgentEvent =
  | { type: "SPAWNED"; at: string }
  | { type: "TOOL_STARTED"; at: string }
  | { type: "TOOL_SUCCEEDED"; at: string }
  | { type: "TOOL_FAILED"; error: string | null; at: string }
  | { type: "PERMISSION_REQUIRED"; at: string }
  /** From the `Stop` hook event — only ever fired for the main session. */
  | { type: "AWAIT_PROMPT"; at: string }
  /** From `UserPromptSubmit` — clears a stale `awaitingPrompt` so a long
   *  non-tool-call generation mid-turn doesn't misreport as still waiting on
   *  the user (see docs/agent-states.md). */
  | { type: "PROMPT_SUBMITTED"; at: string }
  /** From `SubagentStop` (subagent) or `SessionEnd` (either role). */
  | { type: "DONE"; at: string }
  | { type: "DEPART"; at: string };

export function createInitialAgentState(at: string): AgentState {
  return { needsPermission: false, awaitingPrompt: false, done: false, leaving: false, lastError: null, updatedAt: at };
}

export function transitionAgent(state: AgentState, event: AgentEvent): AgentState {
  // Leaving is terminal to everything except SPAWNED (resume) — matches the
  // departure-animation contract this replaces from the old lifecycle enum.
  if (state.leaving && event.type !== "SPAWNED") return state;

  switch (event.type) {
    case "SPAWNED":
      if (state.done || state.leaving) {
        return { needsPermission: false, awaitingPrompt: false, done: false, leaving: false, lastError: null, updatedAt: event.at };
      }
      return state;

    case "TOOL_STARTED":
      // A tool call starting means the agent is clearly no longer blocked on
      // permission, no longer waiting on the user, and no longer done.
      return { ...state, needsPermission: false, awaitingPrompt: false, done: false, lastError: null, updatedAt: event.at };

    case "TOOL_SUCCEEDED":
      return { ...state, lastError: null, updatedAt: event.at };

    case "TOOL_FAILED":
      return { ...state, lastError: event.error, updatedAt: event.at };

    case "PERMISSION_REQUIRED":
      return { ...state, needsPermission: true, updatedAt: event.at };

    case "AWAIT_PROMPT":
      return { ...state, awaitingPrompt: true, updatedAt: event.at };

    case "PROMPT_SUBMITTED":
      return { ...state, awaitingPrompt: false, updatedAt: event.at };

    case "DONE":
      return { ...state, done: true, awaitingPrompt: false, updatedAt: event.at };

    case "DEPART":
      if (state.done) return { ...state, leaving: true, updatedAt: event.at };
      return state;

    default:
      return state;
  }
}
