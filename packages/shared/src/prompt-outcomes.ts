/**
 * Per-prompt outcome attribution.
 *
 * Slices the timeline between UserPromptSubmit events and computes
 * metrics for each prompt's "turn" — what happened between sending
 * a prompt and sending the next one.
 */

import type { WorkshopEvent } from "./workshop-event.js";

export interface PromptOutcome {
  /** The prompt text (may be null if not captured) */
  promptText: string | null;
  sessionId: string;
  timestamp: string;
  /** Duration from prompt to next prompt (or end of timeline) */
  wallTimeMs: number;
  /** Token counts (deduped by requestId from transcript — not available from hooks alone) */
  tokenEstimate: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    total: number;
  } | null;
  /** API calls in this turn */
  apiCalls: number;
  /** Tool calls */
  toolCalls: number;
  failedToolCalls: number;
  /** Files */
  filesRead: number;
  filesEdited: number;
  filesReRead: number;
  /** Subagents spawned */
  subagentsSpawned: number;
  /** Whether Claude asked a clarifying question (Stop event with needsInput) */
  askedClarification: boolean;
  /** Whether the NEXT prompt looks like a correction */
  followedByCorrection: boolean;
  /** Cost estimate (API-equivalent, null if no token data) */
  costEstimate: number | null;
}

/** Patterns that suggest the user is correcting the previous response */
const CORRECTION_PATTERNS = [
  /\bno\b/i, /\bnot that\b/i, /\bwrong\b/i, /\bi meant\b/i,
  /\bagain\b/i, /\bundo\b/i, /\brevert\b/i, /\bfix (this|that|it)\b/i,
  /\bthat's not\b/i, /\bstop\b/i, /\bdon't\b/i, /\binstead\b/i,
];

export function isCorrection(promptText: string): boolean {
  // Short prompts with correction patterns are likely corrections
  if (promptText.length > 200) return false; // Long prompts are usually new tasks
  return CORRECTION_PATTERNS.some((p) => p.test(promptText));
}

/**
 * Compute per-prompt outcomes by slicing the timeline at UserPromptSubmit events.
 * Returns newest first.
 */
export function computePromptOutcomes(
  events: WorkshopEvent[],
  maxPrompts = 10,
): PromptOutcome[] {
  // Find all UserPromptSubmit events
  const promptEvents: Array<{ event: WorkshopEvent; index: number }> = [];
  for (let i = 0; i < events.length; i++) {
    if (events[i].hookEventName === "UserPromptSubmit") {
      promptEvents.push({ event: events[i], index: i });
    }
  }

  // Process last maxPrompts prompts
  const recent = promptEvents.slice(-maxPrompts);
  const outcomes: PromptOutcome[] = [];

  for (let p = 0; p < recent.length; p++) {
    const { event: promptEvent, index: startIdx } = recent[p];
    const endIdx = p < recent.length - 1 ? recent[p + 1].index : events.length;
    const turnEvents = events.slice(startIdx, endIdx);

    const promptText = promptEvent.target ?? null;
    const promptTime = Date.parse(promptEvent.timestamp);
    const endTime = endIdx < events.length
      ? Date.parse(events[endIdx].timestamp)
      : (turnEvents.length > 0 ? Date.parse(turnEvents[turnEvents.length - 1].timestamp) : promptTime);

    let toolCalls = 0;
    let failedToolCalls = 0;
    let apiCalls = 0;
    let subagentsSpawned = 0;
    let askedClarification = false;
    const readFiles = new Set<string>();
    const editedFiles = new Set<string>();

    for (const e of turnEvents) {
      if (e.hookEventName === "PreToolUse") {
        toolCalls++;
        apiCalls++;
        const target = e.target;
        if (e.toolName === "Read" && target) readFiles.add(target);
        if ((e.toolName === "Edit" || e.toolName === "Write") && target) editedFiles.add(target);
      }
      if (e.hookEventName === "PostToolUseFailure") failedToolCalls++;
      if (e.hookEventName === "SubagentStart") subagentsSpawned++;
      if (e.hookEventName === "Stop") askedClarification = true;
    }

    // Count re-reads: files read more than once
    const readCounts = new Map<string, number>();
    for (const e of turnEvents) {
      if (e.hookEventName === "PreToolUse" && e.toolName === "Read" && e.target) {
        readCounts.set(e.target, (readCounts.get(e.target) ?? 0) + 1);
      }
    }
    const filesReRead = Array.from(readCounts.values()).filter((c) => c > 1).length;

    // Check if the NEXT prompt is a correction
    const nextPromptIdx = p < recent.length - 1 ? p + 1 : -1;
    const nextPromptText = nextPromptIdx >= 0 ? recent[nextPromptIdx].event.target : null;
    const followedByCorrection = nextPromptText ? isCorrection(nextPromptText) : false;

    outcomes.push({
      promptText,
      sessionId: promptEvent.sessionId,
      timestamp: promptEvent.timestamp,
      wallTimeMs: Math.max(0, endTime - promptTime),
      tokenEstimate: null, // Filled from token data if available
      apiCalls,
      toolCalls,
      failedToolCalls,
      filesRead: readFiles.size,
      filesEdited: editedFiles.size,
      filesReRead,
      subagentsSpawned,
      askedClarification,
      followedByCorrection,
      costEstimate: null,
    });
  }

  return outcomes.reverse(); // Newest first
}
