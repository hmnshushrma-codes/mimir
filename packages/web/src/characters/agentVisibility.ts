import type { SerializedAgent } from "@agent-workshop/shared";

export type AgentVisibility = "active" | "finished" | "hidden";

export const FINISHED_SHELF_WINDOW_MS = 60_000;

/**
 * Single source of truth for "where does this agent show up right now" —
 * every count badge, cluster grid, and the "Finished today" shelf must all
 * derive from this, not read `agents.length` or re-filter independently.
 * This is exactly the bug that shipped before: a session badge counted every
 * agent ever created (including ones whose lifecycle had already reached
 * "leaving"), while the grid filtered leaving agents out — so "2 agents"
 * showed with only one worker visible. See agentVisibility.test.ts.
 */
export function classifyAgentVisibility(
  agent: Pick<SerializedAgent, "state">,
  nowMs: number,
  finishedWindowMs: number = FINISHED_SHELF_WINDOW_MS
): AgentVisibility {
  if (agent.state.lifecycle !== "leaving") return "active";
  const elapsed = nowMs - Date.parse(agent.state.updatedAt);
  if (!Number.isFinite(elapsed)) return "hidden";
  return elapsed < finishedWindowMs ? "finished" : "hidden";
}

/** The count that should be shown anywhere a cluster/session says "N agents"
 *  — active workers plus the ones still fading in the finished shelf, never
 *  the raw historical total. */
export function countVisibleAgents(agents: Array<Pick<SerializedAgent, "state">>, nowMs: number): number {
  return agents.filter((a) => classifyAgentVisibility(a, nowMs) !== "hidden").length;
}
