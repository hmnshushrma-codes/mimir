import type { SerializedAgent } from "@agent-workshop/shared";
import type { BehaviourContext } from "./types.js";

/** Matches the old profile system's default long-tool-call threshold
 *  (AGENT_WORKSHOP_LONG_TOOL_CALL_MS's 15s default) — past this, a "working"
 *  character starts sweating. */
export const LONG_RUNNING_TOOL_CALL_MS = 15_000;

/** "done" has two phases — a brief thumbs-up beat, then settling into a
 *  relaxed mug-in-hand pose. There's no live signal for which phase beyond
 *  how long ago the agent's state last changed. */
const DONE_PHASE_1_HOLD_MS = 3_000;

/**
 * Builds the live BehaviourContext a real agent maps to — the bridge between
 * `SerializedAgent` (server truth) and `behaviourFor` (pure rendering logic).
 * Used by both ForemanDesk and WorkerDesk so the derivation is identical.
 *
 * `needsInputOptionCount` has no live source yet (AskUserQuestion's option
 * count isn't tracked anywhere in the data model) — defaulted to 0, a known
 * simplification until that's wired up.
 */
export function buildBehaviourContext(
  agent: SerializedAgent,
  opts: { isForeman: boolean; teamColor: string; capColor: string; nowMs: number }
): BehaviourContext {
  const openCall = agent.activeToolCalls[0] ?? null;
  const longRunning = openCall ? opts.nowMs - Date.parse(openCall.startedAt) >= LONG_RUNNING_TOOL_CALL_MS : false;
  const sinceStateChangeMs = opts.nowMs - Date.parse(agent.state.updatedAt);
  const donePhase = sinceStateChangeMs < DONE_PHASE_1_HOLD_MS ? 1 : 2;

  return {
    state: agent.displayState,
    category: openCall?.category ?? null,
    consecutiveErrors: agent.consecutiveErrors,
    isForeman: opts.isForeman,
    needsInputOptionCount: 0,
    donePhase,
    longRunning,
    teamColor: opts.teamColor,
    capColor: opts.capColor
  };
}
