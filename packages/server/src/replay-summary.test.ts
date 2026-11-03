import { describe, expect, it } from "vitest";
import { buildReplaySummary } from "./replay-summary.js";

const CONFIG = { stalledAfterMs: 10_000, sleepAfterMs: 30_000, needsInputTools: new Set(["AskUserQuestion"]) };

function row(payload: Record<string, unknown>, timestamp: string): { rawJson: string } {
  return { rawJson: JSON.stringify({ ...payload, timestamp }) };
}

describe("buildReplaySummary", () => {
  it("attributes time correctly between working and thinking for a short, active session", () => {
    const rows = [
      row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"),
      row(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" },
        "2026-01-01T00:00:01.000Z"
      ),
      row(
        {
          session_id: "s1",
          hook_event_name: "PostToolUse",
          tool_name: "Bash",
          tool_input: { command: "ls" },
          tool_output: "ok",
          tool_use_id: "tu1"
        },
        "2026-01-01T00:00:06.000Z"
      )
    ];

    const [summary] = buildReplaySummary(rows, "2026-01-01T00:00:06.000Z", CONFIG);
    expect(summary.sessionId).toBe("s1");
    expect(summary.agentId).toBe("main");
    expect(summary.isForeman).toBe(true);
    // thinking (1s, from SessionStart to PreToolUse) + working (5s, PreToolUse to PostToolUse)
    expect(summary.stateMs.thinking).toBe(1000);
    expect(summary.stateMs.working).toBe(5000);
    expect(summary.stateMs.sleeping ?? 0).toBe(0);
    expect(summary.transitionCount).toBe(2);
    expect(summary.trailingQuietMs).toBe(0);
  });

  it("synthesizes a thinking -> stalled transition for a real gap exceeding the threshold", () => {
    const rows = [
      row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"),
      // 15s later (> 10s stalledAfterMs) — another tool call on the SAME agent
      row(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" },
        "2026-01-01T00:00:15.000Z"
      )
    ];

    const [summary] = buildReplaySummary(rows, "2026-01-01T00:00:15.000Z", CONFIG);
    // thinking for the first 10s, then stalled for the remaining 5s until the next real event
    expect(summary.stateMs.thinking).toBe(10_000);
    expect(summary.stateMs.stalled).toBe(5_000);
    expect(summary.transitionCount).toBe(2); // thinking -> stalled -> working
  });

  it("synthesizes an awaiting_prompt -> sleeping transition for a real gap exceeding the threshold", () => {
    const rows = [
      row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"),
      row({ session_id: "s1", hook_event_name: "Stop" }, "2026-01-01T00:00:01.000Z"),
      // 40s after Stop (> 30s sleepAfterMs) — the user finally submits another prompt
      row({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "continue" }, "2026-01-01T00:00:41.000Z")
    ];

    const [summary] = buildReplaySummary(rows, "2026-01-01T00:00:41.000Z", CONFIG);
    expect(summary.stateMs.awaiting_prompt).toBe(30_000);
    expect(summary.stateMs.sleeping).toBe(10_000);
  });

  it("reports trailing silence separately, not folded into the percentage-bearing totals", () => {
    const rows = [
      row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"),
      row({ session_id: "s1", hook_event_name: "Stop" }, "2026-01-01T00:00:01.000Z")
    ];

    // asOf is 2 hours after the last real event — an old, abandoned session.
    const asOf = "2026-01-01T02:00:01.000Z";
    const [summary] = buildReplaySummary(rows, asOf, CONFIG);
    expect(summary.totalMs).toBe(1000); // SessionStart -> Stop only
    expect(summary.trailingQuietMs).toBe(2 * 60 * 60 * 1000);
    // None of that 2-hour silence is counted as "sleeping" time in stateMs.
    const totalStateMs = Object.values(summary.stateMs).reduce((a, b) => a + (b ?? 0), 0);
    expect(totalStateMs).toBe(summary.totalMs);
  });

  it("tracks multiple agents in the same session independently", () => {
    const rows = [
      row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"),
      row(
        { session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Explore" },
        "2026-01-01T00:00:01.000Z"
      ),
      row(
        {
          session_id: "s1",
          hook_event_name: "SubagentStop",
          agent_id: "agent-1",
          agent_type: "Explore",
          exit_reason: "completed"
        },
        "2026-01-01T00:00:05.000Z"
      )
    ];

    const summaries = buildReplaySummary(rows, "2026-01-01T00:00:05.000Z", CONFIG);
    expect(summaries).toHaveLength(2);
    const subagent = summaries.find((s) => s.agentId === "agent-1");
    expect(subagent?.isForeman).toBe(false);
    expect(subagent?.stateMs.done).toBeGreaterThanOrEqual(0);
  });

  it("skips malformed rows without throwing", () => {
    const rows = [{ rawJson: "not json" }, row({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0")];
    expect(() => buildReplaySummary(rows, "T0", CONFIG)).not.toThrow();
  });
});
