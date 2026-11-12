/**
 * Incremental transcript JSONL parser for token usage data.
 *
 * Reads Claude Code transcript files at ~/.claude/projects/.../SESSION.jsonl
 * incrementally (tracks byte offset per file, never re-reads the whole file).
 *
 * Deduplicates streaming entries by requestId (last-entry-wins, since
 * output_tokens grows during streaming: 9→9→9→253, final entry is correct).
 *
 * Excludes <synthetic> model entries from token/cost calculations.
 *
 * Context window = (input + cache_creation + cache_read) from the LATEST
 * deduped request, divided by a configurable model max.
 */

import { readFileSync, statSync, existsSync, openSync, readSync, closeSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────

export interface TranscriptUsageEntry {
  requestId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: string;
}

export interface SessionTokenSummary {
  sessionId: string;
  transcriptPath: string;
  model: string | null;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  /** Context window of the LATEST request: input + cache_creation + cache_read */
  latestContextTokens: number;
  /** Turn durations from system entries (ms) */
  totalTurnDurationMs: number;
  turnCount: number;
  lastUpdated: string;
}

export interface TranscriptReaderState {
  byteOffset: number;
  partialLine: string;
  /** requestId → last-seen usage (for dedup) */
  usageByRequestId: Map<string, TranscriptUsageEntry>;
  /** Most recent usage entry (for context window) */
  latestEntry: TranscriptUsageEntry | null;
  totalTurnDurationMs: number;
  turnCount: number;
}

// ─── Model context limits ───────────────────────────────────────────

/** Configurable max context window per model (tokens). */
/** Context limits. Claude Code typically uses 1M context for all models
 *  (the transcript model field doesn't include the [1m] suffix). */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "claude-opus-4-6": 1_000_000,
  "claude-opus-5-5": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-sonnet-5-5": 1_000_000,
  "claude-haiku-4-5": 200_000,
  "claude-haiku-5-5": 1_000_000,
};

export function getContextLimit(model: string): number {
  if (MODEL_CONTEXT_LIMITS[model]) return MODEL_CONTEXT_LIMITS[model];
  // Prefix match
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.startsWith(key) || key.startsWith(model)) return limit;
  }
  return 200_000; // Default
}

// ─── Parser ─────────────────────────────────────────────────────────

export function createReaderState(): TranscriptReaderState {
  return {
    byteOffset: 0,
    partialLine: "",
    usageByRequestId: new Map(),
    latestEntry: null,
    totalTurnDurationMs: 0,
    turnCount: 0,
  };
}

/**
 * Read new bytes from a transcript file since the last read.
 * Returns true if new data was found, false if nothing changed.
 *
 * Handles:
 * - Partial last lines (saved for next read)
 * - Growing files (only reads new bytes)
 * - Truncated/missing files (resets state)
 * - Streaming dedup (requestId last-entry-wins)
 */
export function readTranscriptIncremental(
  filePath: string,
  state: TranscriptReaderState
): boolean {
  if (!existsSync(filePath)) return false;

  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    return false;
  }

  // File was truncated or replaced — reset
  if (fileSize < state.byteOffset) {
    state.byteOffset = 0;
    state.partialLine = "";
    state.usageByRequestId.clear();
    state.latestEntry = null;
    state.totalTurnDurationMs = 0;
    state.turnCount = 0;
  }

  // Nothing new
  if (fileSize <= state.byteOffset) return false;

  // Read only the new bytes
  const buf = Buffer.alloc(fileSize - state.byteOffset);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buf, 0, buf.length, state.byteOffset);
  } finally {
    closeSync(fd);
  }

  state.byteOffset = fileSize;
  const newText = state.partialLine + buf.toString("utf-8");
  const lines = newText.split("\n");

  // Last element may be partial — save for next read
  state.partialLine = lines.pop() ?? "";

  let foundNew = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // Skip corrupt lines
    }

    // Handle system entries with turn_duration
    if (parsed.type === "system" && parsed.subtype === "turn_duration") {
      const dur = parsed.durationMs;
      if (typeof dur === "number") {
        state.totalTurnDurationMs += dur;
        state.turnCount++;
      }
      continue;
    }

    // Only process assistant messages with usage
    if (parsed.type !== "assistant") continue;

    const message = parsed.message as Record<string, unknown> | undefined;
    if (!message) continue;

    const usage = message.usage as Record<string, unknown> | undefined;
    if (!usage || typeof usage.input_tokens !== "number") continue;

    const model = (message.model as string) ?? "";
    // Exclude <synthetic> entries from token accounting
    if (model === "<synthetic>") continue;

    const requestId = (parsed.requestId as string) ?? `unknown-${Date.now()}`;

    const entry: TranscriptUsageEntry = {
      requestId,
      model,
      inputTokens: usage.input_tokens as number,
      outputTokens: (usage.output_tokens as number) ?? 0,
      cacheCreationTokens: (usage.cache_creation_input_tokens as number) ?? 0,
      cacheReadTokens: (usage.cache_read_input_tokens as number) ?? 0,
      timestamp: (parsed.timestamp as string) ?? new Date().toISOString(),
    };

    // Last-entry-wins dedup: streaming produces multiple entries per requestId
    // with growing output_tokens. The final entry has the correct total.
    state.usageByRequestId.set(requestId, entry);
    state.latestEntry = entry;
    foundNew = true;
  }

  return foundNew;
}

/**
 * Build a summary from the current reader state.
 */
export function buildSummary(
  sessionId: string,
  transcriptPath: string,
  state: TranscriptReaderState
): SessionTokenSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  const modelCounts = new Map<string, number>();

  for (const entry of state.usageByRequestId.values()) {
    inputTokens += entry.inputTokens;
    outputTokens += entry.outputTokens;
    cacheCreationTokens += entry.cacheCreationTokens;
    cacheReadTokens += entry.cacheReadTokens;
    modelCounts.set(entry.model, (modelCounts.get(entry.model) ?? 0) + 1);
  }

  // Dominant model
  let dominantModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of modelCounts) {
    if (count > maxCount) { dominantModel = model; maxCount = count; }
  }

  // Context window = latest request's (input + cache_creation + cache_read)
  const latest = state.latestEntry;
  const latestContextTokens = latest
    ? latest.inputTokens + latest.cacheCreationTokens + latest.cacheReadTokens
    : 0;

  return {
    sessionId,
    transcriptPath,
    model: dominantModel,
    apiCalls: state.usageByRequestId.size,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    latestContextTokens,
    totalTurnDurationMs: state.totalTurnDurationMs,
    turnCount: state.turnCount,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Subagent transcript discovery ──────────────────────────────────

export interface SubagentTokenSummary {
  agentId: string;
  model: string | null;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/**
 * Discover and read subagent transcripts.
 * Subagent transcripts live at: <transcript_dir>/<session_id>/subagents/agent-<id>.jsonl
 * They use the same format as the main transcript.
 */
export function readSubagentTranscripts(mainTranscriptPath: string): SubagentTokenSummary[] {
  const dir = dirname(mainTranscriptPath);
  const sessionId = mainTranscriptPath.replace(/\.jsonl$/, "").split("/").pop() ?? "";
  const subagentDir = join(dir, sessionId, "subagents");

  if (!existsSync(subagentDir)) return [];

  const results: SubagentTokenSummary[] = [];
  let files: string[];
  try {
    files = readdirSync(subagentDir).filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl"));
  } catch {
    return [];
  }

  for (const file of files) {
    const agentId = file.replace("agent-", "").replace(".jsonl", "");
    const filePath = join(subagentDir, file);
    const state = createReaderState();
    readTranscriptIncremental(filePath, state);

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    const modelCounts = new Map<string, number>();

    for (const entry of state.usageByRequestId.values()) {
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      cacheCreationTokens += entry.cacheCreationTokens;
      cacheReadTokens += entry.cacheReadTokens;
      modelCounts.set(entry.model, (modelCounts.get(entry.model) ?? 0) + 1);
    }

    let dominantModel: string | null = null;
    let maxCount = 0;
    for (const [model, count] of modelCounts) {
      if (count > maxCount) { dominantModel = model; maxCount = count; }
    }

    results.push({
      agentId,
      model: dominantModel,
      apiCalls: state.usageByRequestId.size,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
    });
  }

  return results;
}
