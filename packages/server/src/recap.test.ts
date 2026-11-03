import { describe, expect, it } from "vitest";
import { buildRecapTranscript } from "./recap.js";
import type { EventRecord } from "./db.js";

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 1,
    sessionId: "s1",
    agentId: "main",
    agentType: null,
    hookEventName: "PreToolUse",
    category: "shell",
    toolName: "Bash",
    toolUseId: "tu1",
    target: "ls",
    timestamp: "2026-01-01T00:00:00.000Z",
    previewInput: null,
    previewOutput: null,
    rawJson: "{}",
    ...overrides
  };
}

describe("buildRecapTranscript", () => {
  it("includes user prompts and tool calls in order", () => {
    const transcript = buildRecapTranscript([
      event({ hookEventName: "UserPromptSubmit", target: "fix the bug", toolName: null }),
      event({ hookEventName: "PreToolUse", toolName: "Bash", target: "git status" })
    ]);
    expect(transcript).toBe("User: fix the bug\nTool Bash: git status");
  });

  it("marks failed tool calls", () => {
    const transcript = buildRecapTranscript([event({ hookEventName: "PostToolUseFailure", toolName: "Bash" })]);
    expect(transcript).toBe("Tool Bash FAILED");
  });

  it("ignores events with no renderable content", () => {
    const transcript = buildRecapTranscript([event({ hookEventName: "SessionStart", toolName: null, target: null })]);
    expect(transcript).toBe("");
  });

  it("truncates very long transcripts", () => {
    const events = Array.from({ length: 2000 }, () => event({ hookEventName: "PreToolUse", toolName: "Bash", target: "x".repeat(20) }));
    const transcript = buildRecapTranscript(events);
    expect(transcript.length).toBeLessThan(8100);
    expect(transcript.endsWith("[...truncated]")).toBe(true);
  });
});
