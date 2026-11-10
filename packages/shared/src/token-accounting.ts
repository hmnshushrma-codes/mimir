/**
 * Token Usage Accounting — Part 3, Issue #5
 *
 * Token data is NOT available in Claude Code hook payloads.
 * It IS available in transcript .jsonl files at ~/.claude/projects/...
 * under `message.usage` in assistant-type lines.
 *
 * This module provides:
 * 1. TranscriptUsage type matching the real transcript format
 * 2. Parsing/aggregation functions for transcript usage data
 * 3. Session-level token accounting with measured/unavailable distinction
 */

import type { TokenUsage, MaybeAvailable } from "./analytics.js";
import { EMPTY_TOKEN_USAGE } from "./analytics.js";

// ─── Transcript usage format (from .jsonl files) ────────────────────

/** The exact shape of `message.usage` in Claude Code transcript lines. */
export interface TranscriptUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

/** A single transcript assistant message with usage data. */
export interface TranscriptEntry {
  sessionId: string;
  model: string | null;
  usage: TranscriptUsage;
  timestamp: string;
}

// ─── Parsing ────────────────────────────────────────────────────────

/** Extract usage entries from parsed transcript JSONL lines.
 *  Each line is a JSON object; we only care about assistant messages
 *  that have `.message.usage.input_tokens`. */
export function extractUsageFromTranscriptLines(lines: unknown[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    if (typeof line !== "object" || line === null) continue;
    const obj = line as Record<string, unknown>;
    if (obj.type !== "assistant") continue;

    const message = obj.message as Record<string, unknown> | undefined;
    if (!message) continue;

    const usage = message.usage as Record<string, unknown> | undefined;
    if (!usage || typeof usage.input_tokens !== "number") continue;

    entries.push({
      sessionId: (obj.sessionId as string) ?? "",
      model: (message.model as string) ?? null,
      usage: {
        input_tokens: usage.input_tokens as number,
        output_tokens: (usage.output_tokens as number) ?? 0,
        cache_creation_input_tokens: (usage.cache_creation_input_tokens as number) ?? 0,
        cache_read_input_tokens: (usage.cache_read_input_tokens as number) ?? 0,
      },
      timestamp: (obj.timestamp as string) ?? new Date().toISOString(),
    });
  }
  return entries;
}

// ─── Aggregation ────────────────────────────────────────────────────

function measured(value: number): MaybeAvailable<number> {
  return { value, availability: "measured", source: "transcript" };
}

/** Aggregate multiple transcript entries into a single TokenUsage. */
export function aggregateTokenUsage(entries: TranscriptEntry[]): TokenUsage {
  if (entries.length === 0) return EMPTY_TOKEN_USAGE;

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;

  for (const entry of entries) {
    inputTokens += entry.usage.input_tokens;
    outputTokens += entry.usage.output_tokens;
    cacheCreationTokens += entry.usage.cache_creation_input_tokens ?? 0;
    cacheReadTokens += entry.usage.cache_read_input_tokens ?? 0;
  }

  return {
    inputTokens: measured(inputTokens),
    outputTokens: measured(outputTokens),
    cacheCreationTokens: measured(cacheCreationTokens),
    cacheReadTokens: measured(cacheReadTokens),
  };
}

/** Get the dominant model from a set of transcript entries. */
export function dominantModel(entries: TranscriptEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.model) counts.set(e.model, (counts.get(e.model) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [model, count] of counts) {
    if (count > bestCount) { best = model; bestCount = count; }
  }
  return best;
}

/** Sum two TokenUsage objects, preserving availability. If either is measured,
 *  result is measured. If both unavailable, result is unavailable. */
export function sumTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  function add(x: MaybeAvailable<number>, y: MaybeAvailable<number>): MaybeAvailable<number> {
    if (x.availability === "unavailable" && y.availability === "unavailable") {
      return { value: 0, availability: "unavailable", source: "none" };
    }
    const best = x.availability === "measured" || y.availability === "measured" ? "measured" : "estimated";
    return { value: x.value + y.value, availability: best, source: x.source !== "none" ? x.source : y.source };
  }
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
    cacheCreationTokens: add(a.cacheCreationTokens, b.cacheCreationTokens),
    cacheReadTokens: add(a.cacheReadTokens, b.cacheReadTokens),
  };
}

/** Total token count from a TokenUsage (input + output + cache). */
export function totalTokens(usage: TokenUsage): MaybeAvailable<number> {
  const total = usage.inputTokens.value + usage.outputTokens.value
    + usage.cacheCreationTokens.value + usage.cacheReadTokens.value;
  if (usage.inputTokens.availability === "unavailable") {
    return { value: 0, availability: "unavailable", source: "none" };
  }
  return { value: total, availability: usage.inputTokens.availability, source: usage.inputTokens.source };
}
