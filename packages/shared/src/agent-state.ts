import type { ActionCategory } from "./categories.js";

/**
 * entering -> idle <-> working(category) -> waiting_permission -> error -> done -> leaving
 *
 * The UI only ever renders this state; it never derives lifecycle logic
 * itself. See agent-state.test.ts for the exhaustive transition table this
 * reducer implements.
 */
export const AGENT_LIFECYCLES = [
  "entering",
  "idle",
  "working",
  "waiting_permission",
  "error",
  "done",
  "leaving"
] as const;

export type AgentLifecycle = (typeof AGENT_LIFECYCLES)[number];

export interface AgentState {
  lifecycle: AgentLifecycle;
  category: ActionCategory | null;
  lastError: string | null;
  updatedAt: string;
}

export type AgentEvent =
  | { type: "SPAWNED"; at: string }
  | { type: "TOOL_STARTED"; category: ActionCategory; at: string }
  | { type: "TOOL_SUCCEEDED"; at: string }
  | { type: "TOOL_FAILED"; error: string | null; at: string }
  | { type: "PERMISSION_REQUIRED"; at: string }
  | { type: "PERMISSION_RESOLVED"; at: string }
  | { type: "STOPPED"; at: string }
  | { type: "DEPART"; at: string };

export function createInitialAgentState(at: string): AgentState {
  return { lifecycle: "entering", category: null, lastError: null, updatedAt: at };
}

export function transitionAgent(state: AgentState, event: AgentEvent): AgentState {
  const { lifecycle } = state;

  switch (event.type) {
    case "SPAWNED":
      if (lifecycle === "done" || lifecycle === "leaving") {
        return { lifecycle: "entering", category: null, lastError: null, updatedAt: event.at };
      }
      return state;

    case "TOOL_STARTED":
      if (lifecycle === "done" || lifecycle === "leaving") return state;
      return { lifecycle: "working", category: event.category, lastError: null, updatedAt: event.at };

    case "TOOL_SUCCEEDED":
      if (lifecycle === "working" || lifecycle === "error" || lifecycle === "entering") {
        return { lifecycle: "idle", category: null, lastError: null, updatedAt: event.at };
      }
      return state;

    case "TOOL_FAILED":
      if (lifecycle === "done" || lifecycle === "leaving") return state;
      return { lifecycle: "error", category: state.category, lastError: event.error, updatedAt: event.at };

    case "PERMISSION_REQUIRED":
      if (lifecycle === "working" || lifecycle === "idle" || lifecycle === "entering") {
        return { lifecycle: "waiting_permission", category: state.category, lastError: null, updatedAt: event.at };
      }
      return state;

    case "PERMISSION_RESOLVED":
      if (lifecycle === "waiting_permission") {
        return { lifecycle: "idle", category: null, lastError: null, updatedAt: event.at };
      }
      return state;

    case "STOPPED":
      if (lifecycle === "done" || lifecycle === "leaving") return state;
      return { lifecycle: "done", category: null, lastError: null, updatedAt: event.at };

    case "DEPART":
      if (lifecycle === "done") {
        return { lifecycle: "leaving", category: null, lastError: null, updatedAt: event.at };
      }
      return state;

    default:
      return state;
  }
}
