import { describe, it, expect } from "vitest";
import { computePromptOutcomes, isCorrection } from "./prompt-outcomes.js";
import type { WorkshopEvent } from "./workshop-event.js";

function ev(hookEventName: string, target?: string, toolName?: string, ts = "2026-01-01T00:00:00Z"): WorkshopEvent {
  return {
    sessionId: "s1", agentId: "main", agentType: null,
    hookEventName, category: "other", toolName: toolName ?? null,
    toolUseId: null, target: target ?? null, timestamp: ts,
    raw: { session_id: "s1", hook_event_name: hookEventName, timestamp: ts },
  } as WorkshopEvent;
}

describe("isCorrection", () => {
  it("detects 'no' as correction", () => expect(isCorrection("no")).toBe(true));
  it("detects 'not that'", () => expect(isCorrection("not that, use the other one")).toBe(true));
  it("detects 'I meant'", () => expect(isCorrection("I meant the login page")).toBe(true));
  it("detects 'undo'", () => expect(isCorrection("undo that")).toBe(true));
  it("detects 'revert'", () => expect(isCorrection("revert the last change")).toBe(true));
  it("rejects long prompts", () => expect(isCorrection("no ".repeat(100))).toBe(false));
  it("rejects normal prompts", () => expect(isCorrection("add a new feature to the dashboard")).toBe(false));
});

describe("computePromptOutcomes", () => {
  it("slices events between UserPromptSubmit events", () => {
    const events = [
      ev("UserPromptSubmit", "fix the bug", undefined, "2026-01-01T00:00:00Z"),
      ev("PreToolUse", "/a.ts", "Read", "2026-01-01T00:00:01Z"),
      ev("PreToolUse", "/a.ts", "Edit", "2026-01-01T00:00:02Z"),
      ev("UserPromptSubmit", "add tests", undefined, "2026-01-01T00:01:00Z"),
      ev("PreToolUse", "/b.ts", "Read", "2026-01-01T00:01:01Z"),
    ];
    const outcomes = computePromptOutcomes(events);
    expect(outcomes).toHaveLength(2);
    // Newest first
    expect(outcomes[0].promptText).toBe("add tests");
    expect(outcomes[0].toolCalls).toBe(1);
    expect(outcomes[1].promptText).toBe("fix the bug");
    expect(outcomes[1].toolCalls).toBe(2);
  });

  it("counts tool calls and failures", () => {
    const events = [
      ev("UserPromptSubmit", "run tests"),
      ev("PreToolUse", "npm test", "Bash"),
      ev("PostToolUseFailure", null, "Bash"),
      ev("PreToolUse", "npm test", "Bash"),
    ];
    const o = computePromptOutcomes(events)[0];
    expect(o.toolCalls).toBe(2);
    expect(o.failedToolCalls).toBe(1);
  });

  it("counts files read, edited, and re-read", () => {
    const events = [
      ev("UserPromptSubmit", "fix it"),
      ev("PreToolUse", "/a.ts", "Read"),
      ev("PreToolUse", "/b.ts", "Read"),
      ev("PreToolUse", "/a.ts", "Read"), // re-read
      ev("PreToolUse", "/a.ts", "Edit"),
    ];
    const o = computePromptOutcomes(events)[0];
    expect(o.filesRead).toBe(2); // unique
    expect(o.filesEdited).toBe(1);
    expect(o.filesReRead).toBe(1); // /a.ts read twice
  });

  it("detects correction in next prompt", () => {
    const events = [
      ev("UserPromptSubmit", "add a feature", undefined, "2026-01-01T00:00:00Z"),
      ev("PreToolUse", "/a.ts", "Edit", "2026-01-01T00:00:01Z"),
      ev("UserPromptSubmit", "no not that", undefined, "2026-01-01T00:01:00Z"),
    ];
    const outcomes = computePromptOutcomes(events);
    expect(outcomes[1].followedByCorrection).toBe(true); // "add a feature" followed by correction
    expect(outcomes[0].followedByCorrection).toBe(false); // "no not that" is the last
  });

  it("detects subagent spawning", () => {
    const events = [
      ev("UserPromptSubmit", "research this"),
      ev("SubagentStart"),
      ev("SubagentStart"),
    ];
    expect(computePromptOutcomes(events)[0].subagentsSpawned).toBe(2);
  });

  it("computes wall time", () => {
    const events = [
      ev("UserPromptSubmit", "fix", undefined, "2026-01-01T00:00:00Z"),
      ev("PreToolUse", "/a.ts", "Read", "2026-01-01T00:00:30Z"),
      ev("UserPromptSubmit", "next", undefined, "2026-01-01T00:01:00Z"),
    ];
    const o = computePromptOutcomes(events)[1]; // "fix" prompt
    expect(o.wallTimeMs).toBe(60000); // 1 minute
  });

  it("returns newest first, max 10", () => {
    const events: WorkshopEvent[] = [];
    for (let i = 0; i < 15; i++) {
      events.push(ev("UserPromptSubmit", `prompt ${i}`, undefined, `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`));
    }
    const outcomes = computePromptOutcomes(events, 10);
    expect(outcomes).toHaveLength(10);
    expect(outcomes[0].promptText).toBe("prompt 14"); // newest
  });

  it("returns empty for no prompts", () => {
    expect(computePromptOutcomes([])).toHaveLength(0);
  });
});
