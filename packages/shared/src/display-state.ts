import type { ActionCategory } from "./categories.js";

/**
 * The ten agent display states — see docs/agent-states.md for the full
 * table, rationale, and the two decisions (thinking/stalled boundary,
 * needs_input detection) made explicit there. This is the single
 * authoritative "what is this agent doing" value; everything else
 * (mood, character pose, monitor content) derives from it.
 */
export const DISPLAY_STATES = [
  "needs_permission",
  "needs_input",
  "error",
  "working",
  "supervising",
  "thinking",
  "stalled",
  "awaiting_prompt",
  "sleeping",
  "done"
] as const;

export type DisplayState = (typeof DISPLAY_STATES)[number];

export interface OpenToolCall {
  toolName: string;
  category: ActionCategory;
  startedAt: string;
}

export interface DisplayStateContext {
  needsPermission: boolean;
  openToolCalls: OpenToolCall[];
  awaitingPrompt: boolean;
  done: boolean;
  consecutiveErrors: number;
  lastError: string | null;
  /** Timestamp of the agent's most recent event of any kind — the basis for
   *  every elapsed-time check below. */
  lastEventAt: string;
  isForeman: boolean;
  hasActiveSubagents: boolean;
  nowIso: string;
}

export interface DisplayStateConfig {
  /** thinking -> stalled boundary. See docs/agent-states.md decision #1. */
  stalledAfterMs: number;
  /** awaiting_prompt -> sleeping boundary. */
  sleepAfterMs: number;
  /** Tool names whose open call means "blocked on a question", not "working". */
  needsInputTools: ReadonlySet<string>;
}

export const DEFAULT_STALLED_AFTER_MS = 90_000;
export const DEFAULT_SLEEP_AFTER_MS = 300_000;
export const DEFAULT_NEEDS_INPUT_TOOLS: ReadonlySet<string> = new Set(["AskUserQuestion"]);

export const DEFAULT_DISPLAY_STATE_CONFIG: DisplayStateConfig = {
  stalledAfterMs: DEFAULT_STALLED_AFTER_MS,
  sleepAfterMs: DEFAULT_SLEEP_AFTER_MS,
  needsInputTools: DEFAULT_NEEDS_INPUT_TOOLS
};

export interface DisplayStateResult {
  state: DisplayState;
  reason: string;
}

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms)) return "0s";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
}

function earliestCall(calls: OpenToolCall[]): OpenToolCall | null {
  let earliest: OpenToolCall | null = null;
  for (const call of calls) {
    if (!earliest || call.startedAt < earliest.startedAt) earliest = call;
  }
  return earliest;
}

/**
 * Pure, priority-ordered derivation of an agent's display state. Checked in
 * the exact order of docs/agent-states.md's table — first match wins.
 *
 * `thinking`/`stalled` are gated on `!awaitingPrompt && !done`: without that
 * gate they'd match unconditionally for any remaining elapsed time and make
 * `awaiting_prompt`/`sleeping`/`done` unreachable. See the doc's "Why
 * thinking/stalled don't swallow..." section.
 */
export function deriveDisplayState(ctx: DisplayStateContext, config: DisplayStateConfig = DEFAULT_DISPLAY_STATE_CONFIG): DisplayStateResult {
  const now = Date.parse(ctx.nowIso);
  const rawElapsedSinceLastEvent = now - Date.parse(ctx.lastEventAt);
  // An unparseable timestamp must never silently read as "ancient" (-> stalled/sleeping) —
  // treat it as "just happened" instead.
  const elapsedSinceLastEvent = Number.isFinite(rawElapsedSinceLastEvent) ? rawElapsedSinceLastEvent : 0;

  if (ctx.needsPermission) {
    return { state: "needs_permission", reason: "waiting on permission" };
  }

  const needsInputCall = ctx.openToolCalls.find((c) => config.needsInputTools.has(c.toolName));
  if (needsInputCall) {
    const elapsed = now - Date.parse(needsInputCall.startedAt);
    return { state: "needs_input", reason: `question pending · ${formatElapsed(elapsed)}` };
  }

  if (ctx.consecutiveErrors > 0) {
    return { state: "error", reason: ctx.lastError ?? "tool failed" };
  }

  const openCall = earliestCall(ctx.openToolCalls);
  if (openCall) {
    const elapsed = now - Date.parse(openCall.startedAt);
    return { state: "working", reason: `${openCall.toolName} · ${formatElapsed(elapsed)}` };
  }

  if (ctx.isForeman && ctx.hasActiveSubagents) {
    return { state: "supervising", reason: "supervising subagents" };
  }

  if (!ctx.awaitingPrompt && !ctx.done) {
    if (elapsedSinceLastEvent < config.stalledAfterMs) {
      return { state: "thinking", reason: formatElapsed(elapsedSinceLastEvent) };
    }
    return { state: "stalled", reason: `no activity for ${formatElapsed(elapsedSinceLastEvent)}` };
  }

  if (ctx.awaitingPrompt) {
    if (elapsedSinceLastEvent >= config.sleepAfterMs) {
      return { state: "sleeping", reason: `asleep for ${formatElapsed(elapsedSinceLastEvent)}` };
    }
    return { state: "awaiting_prompt", reason: "waiting for your next prompt" };
  }

  return { state: "done", reason: "finished" };
}
