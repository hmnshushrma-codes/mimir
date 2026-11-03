import {
  DEFAULT_DISPLAY_STATE_CONFIG,
  HookEventEnvelopeSchema,
  MAIN_AGENT_ID,
  WorkshopModel,
  type DisplayState,
  type DisplayStateConfig
} from "@agent-workshop/shared";
import type { DatabaseSync } from "node:sqlite";
import { listAllEventsRaw } from "./db.js";

interface TimelineEntry {
  state: DisplayState;
  enteredAt: string;
}

interface AgentTimeline {
  sessionId: string;
  agentId: string;
  isForeman: boolean;
  entries: TimelineEntry[];
  lastRealEventAt: string;
}

export interface ReplayAgentSummary {
  sessionId: string;
  agentId: string;
  isForeman: boolean;
  /** Span from this agent's first to last real event — the denominator for percentages. */
  totalMs: number;
  stateMs: Partial<Record<DisplayState, number>>;
  transitionCount: number;
  /** Time from the last real event to `asOfIso`, reported separately rather
   *  than folded into the percentages — many stored sessions are simply old
   *  and abandoned, and counting that silence as "stalled" would misrepresent
   *  active-work behavior, which is exactly what this report needs to show. */
  trailingQuietMs: number;
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

/**
 * Replays stored raw events through a fresh WorkshopModel, recording a
 * per-agent timeline of display-state transitions. Between consecutive real
 * events for the same agent, analytically inserts the synthetic transition
 * that real elapsed time would have produced (thinking -> stalled,
 * awaiting_prompt -> sleeping) — otherwise a replay that just processes
 * events back-to-back would never observe time-only transitions at all,
 * since no event triggers them.
 */
export function buildReplaySummary(
  rawRows: Array<{ rawJson: string }>,
  asOfIso: string,
  config: DisplayStateConfig = DEFAULT_DISPLAY_STATE_CONFIG
): ReplayAgentSummary[] {
  const model = new WorkshopModel(config);
  const timelines = new Map<string, AgentTimeline>();

  for (const row of rawRows) {
    let envelope: unknown;
    try {
      envelope = JSON.parse(row.rawJson);
    } catch {
      continue;
    }
    const parsed = HookEventEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) continue;

    const sessionId = parsed.data.session_id;
    const agentId = (parsed.data as { agent_id?: string }).agent_id ?? MAIN_AGENT_ID;
    const key = `${sessionId}:${agentId}`;
    const timestamp = parsed.data.timestamp;

    const existing = timelines.get(key);
    if (existing && timestamp > existing.lastRealEventAt) {
      const gapMs = Date.parse(timestamp) - Date.parse(existing.lastRealEventAt);
      const lastEntry = existing.entries[existing.entries.length - 1];
      if (lastEntry.state === "thinking" && gapMs >= config.stalledAfterMs) {
        existing.entries.push({ state: "stalled", enteredAt: addMs(existing.lastRealEventAt, config.stalledAfterMs) });
      } else if (lastEntry.state === "awaiting_prompt" && gapMs >= config.sleepAfterMs) {
        existing.entries.push({ state: "sleeping", enteredAt: addMs(existing.lastRealEventAt, config.sleepAfterMs) });
      }
    }

    const { agent } = model.ingest(parsed.data);

    const tl = timelines.get(key);
    if (!tl) {
      timelines.set(key, {
        sessionId,
        agentId,
        isForeman: agentId === MAIN_AGENT_ID,
        entries: [{ state: agent.displayState, enteredAt: timestamp }],
        lastRealEventAt: timestamp
      });
    } else {
      const last = tl.entries[tl.entries.length - 1];
      if (last.state !== agent.displayState) {
        tl.entries.push({ state: agent.displayState, enteredAt: timestamp });
      }
      tl.lastRealEventAt = timestamp;
    }
  }

  const asOfMs = Date.parse(asOfIso);
  const summaries: ReplayAgentSummary[] = [];
  for (const tl of timelines.values()) {
    const stateMs: Partial<Record<DisplayState, number>> = {};
    for (let i = 0; i < tl.entries.length; i++) {
      const start = Date.parse(tl.entries[i].enteredAt);
      const end = i + 1 < tl.entries.length ? Date.parse(tl.entries[i + 1].enteredAt) : Date.parse(tl.lastRealEventAt);
      const dur = Math.max(0, end - start);
      stateMs[tl.entries[i].state] = (stateMs[tl.entries[i].state] ?? 0) + dur;
    }
    summaries.push({
      sessionId: tl.sessionId,
      agentId: tl.agentId,
      isForeman: tl.isForeman,
      totalMs: Math.max(0, Date.parse(tl.lastRealEventAt) - Date.parse(tl.entries[0].enteredAt)),
      stateMs,
      transitionCount: Math.max(0, tl.entries.length - 1),
      trailingQuietMs: Math.max(0, asOfMs - Date.parse(tl.lastRealEventAt))
    });
  }
  return summaries;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function printReplaySummary(summaries: ReplayAgentSummary[]): void {
  for (const s of summaries) {
    console.log(`\n${s.sessionId} / ${s.agentId}${s.isForeman ? " (foreman)" : ""}`);
    console.log(`  total tracked: ${formatMs(s.totalMs)}, ${s.transitionCount} transitions`);
    const entries = Object.entries(s.stateMs) as Array<[DisplayState, number]>;
    entries.sort((a, b) => b[1] - a[1]);
    for (const [state, ms] of entries) {
      const pct = s.totalMs > 0 ? ((ms / s.totalMs) * 100).toFixed(1) : "0.0";
      console.log(`    ${state.padEnd(16)} ${formatMs(ms).padStart(8)}  (${pct}%)`);
    }
    if (s.trailingQuietMs > 60_000) {
      console.log(`  quiet for ${formatMs(s.trailingQuietMs)} since last event (excluded from percentages above)`);
    }
  }
}

export function runReplaySummary(db: DatabaseSync, asOfIso: string = new Date().toISOString()): void {
  const rows = listAllEventsRaw(db);
  const summaries = buildReplaySummary(rows, asOfIso);
  if (summaries.length === 0) {
    console.log("No events to replay.");
    return;
  }
  printReplaySummary(summaries);
}
