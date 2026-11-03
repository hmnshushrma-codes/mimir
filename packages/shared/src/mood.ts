import type { DisplayState } from "./display-state.js";
import type { ActionCategory } from "./categories.js";

/**
 * Mood is a presentational layer on top of the agent display state: it never
 * changes what an agent IS doing, only how that gets drawn (eyes/eyebrows/
 * mouth/posture/icon) in the current Character.tsx rig. Kept deterministic
 * and unit-testable, per the "UI only draws state" rule this project follows.
 *
 * This is a compatibility shim for Part 1: the visual rig (Character.tsx,
 * Face.tsx, MoodIcon.tsx) is unchanged until Part 2, so `displayState` maps
 * onto the existing mood vocabulary here rather than every renderer being
 * rewritten twice. Two mappings are necessarily imperfect placeholders until
 * Part 2 gives these states their own look:
 *   - `needs_input` currently borrows `worried` (same as needs_permission).
 *   - `stalled` maps to `concentrating` (sweat-drop icon), deliberately NOT
 *     `sleepy` — the whole point of adding `stalled` was a "subtle warning",
 *     not another Zzz.
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
  state: DisplayState;
  /** The active tool call's category, if any — only meaningful while
   *  `state === "working"` (delegate -> excited). */
  category: ActionCategory | null;
  /** startedAt of the agent's oldest still-running tool call, if any — only
   *  meaningful while `state === "working"` (long-running -> concentrating). */
  activeToolCallStartedAt: string | null;
  /** Consecutive PostToolUseFailure events with no success in between. */
  consecutiveErrors: number;
  nowIso: string;
}

export const DEFAULT_LONG_TOOL_CALL_MS = 15_000;
export const FRUSTRATED_AFTER_ERRORS = 3;

export function deriveMood(ctx: MoodContext, longToolCallMs: number = DEFAULT_LONG_TOOL_CALL_MS): Mood {
  switch (ctx.state) {
    case "needs_permission":
    case "needs_input":
      return "worried";
    case "error":
      return ctx.consecutiveErrors >= FRUSTRATED_AFTER_ERRORS ? "frustrated" : "dizzy";
    case "working": {
      if (ctx.category === "delegate") return "excited";
      if (ctx.activeToolCallStartedAt) {
        const elapsed = Date.parse(ctx.nowIso) - Date.parse(ctx.activeToolCallStartedAt);
        if (Number.isFinite(elapsed) && elapsed >= longToolCallMs) return "concentrating";
      }
      return "focused";
    }
    case "supervising":
      return "concentrating";
    case "thinking":
      return "focused";
    case "stalled":
      return "concentrating";
    case "awaiting_prompt":
      return "focused";
    case "sleeping":
      return "sleepy";
    case "done":
      return "proud";
    default:
      return "neutral";
  }
}
