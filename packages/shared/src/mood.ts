import type { AgentLifecycle } from "./agent-state.js";
import type { ActionCategory } from "./categories.js";

/**
 * Mood is a presentational layer on top of the agent lifecycle state
 * machine: it never changes what an agent IS doing, only how that gets
 * drawn (eyes/eyebrows/mouth/posture/icon). Deriving it here — not in the
 * UI — keeps it deterministic and unit-testable, per the "UI only draws
 * state" rule the rest of this project already follows for lifecycle.
 */
export const MOODS = [
  "focused",
  "concentrating",
  "worried",
  "dizzy",
  "frustrated",
  "sleepy",
  "excited",
  "proud",
  "neutral"
] as const;

export type Mood = (typeof MOODS)[number];

export interface MoodContext {
  lifecycle: AgentLifecycle;
  category: ActionCategory | null;
  /** startedAt of the agent's oldest still-running tool call, if any. */
  activeToolCallStartedAt: string | null;
  /** Consecutive PostToolUseFailure events with no success in between. */
  consecutiveErrors: number;
  nowIso: string;
  /** True for the main/foreman agent — affects idle behavior. */
  isForeman?: boolean;
  /** True when any subagent in this session is still actively working. */
  hasActiveSubagents?: boolean;
}

export const DEFAULT_LONG_TOOL_CALL_MS = 15_000;
export const FRUSTRATED_AFTER_ERRORS = 3;

/**
 * Pure mood derivation. waiting_permission and error/done/idle map directly
 * off the lifecycle (lifecycle is a single value, so there's no "priority"
 * conflict to resolve — the brief's "most noticeable state" requirement is a
 * UI emphasis concern, not a data one). "working" branches further on
 * category (delegate -> excited) and elapsed time on the active tool call
 * (long-running -> concentrating).
 */
export function deriveMood(ctx: MoodContext, longToolCallMs: number = DEFAULT_LONG_TOOL_CALL_MS): Mood {
  switch (ctx.lifecycle) {
    case "waiting_permission":
      return "worried";
    case "error":
      return ctx.consecutiveErrors >= FRUSTRATED_AFTER_ERRORS ? "frustrated" : "dizzy";
    case "done":
      return "proud";
    case "idle":
      // Foreman with active subagents is "supervising" (concentrating), not sleeping.
      // Foreman alone between tool calls is "thinking" (focused), not sleeping.
      if (ctx.isForeman) {
        if (ctx.hasActiveSubagents) return "concentrating";
        return "focused";
      }
      return "sleepy";
    case "working": {
      if (ctx.category === "delegate") return "excited";
      if (ctx.activeToolCallStartedAt) {
        const elapsed = Date.parse(ctx.nowIso) - Date.parse(ctx.activeToolCallStartedAt);
        if (Number.isFinite(elapsed) && elapsed >= longToolCallMs) return "concentrating";
      }
      return "focused";
    }
    case "entering":
    case "leaving":
    default:
      return "neutral";
  }
}
