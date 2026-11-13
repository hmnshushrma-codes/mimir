import { describe, it, expect } from "vitest";
import { deriveMetrics } from "./data-derivation.js";
import type { WorkshopEvent } from "./workshop-event.js";

function makeEvent(overrides: Partial<WorkshopEvent> & { tool_input?: unknown }): WorkshopEvent {
  const { tool_input, ...rest } = overrides;
  return {
    sessionId: "s1",
    agentId: "main",
    agentType: null,
    hookEventName: "PreToolUse",
    category: "other",
    toolName: null,
    toolUseId: null,
    target: null,
    timestamp: "2026-01-01T00:00:00Z",
    raw: {
      session_id: "s1",
      hook_event_name: rest.hookEventName ?? "PreToolUse",
      timestamp: "2026-01-01T00:00:00Z",
      tool_input,
    },
    ...rest,
  } as WorkshopEvent;
}

describe("deriveMetrics", () => {
  it("counts lines added/removed from Edit", () => {
    const events = [
      makeEvent({ toolName: "Edit", tool_input: { file_path: "/a.ts", old_string: "line1\nline2", new_string: "line1\nline2\nline3\nline4" } }),
    ];
    const m = deriveMetrics(events);
    expect(m.linesAdded).toBe(2);
    expect(m.linesRemoved).toBe(0);
    expect(m.filesModified).toBe(1);
  });

  it("counts lines from Write as added", () => {
    const events = [
      makeEvent({ toolName: "Write", tool_input: { file_path: "/new.ts", content: "a\nb\nc\nd\ne" } }),
    ];
    const m = deriveMetrics(events);
    expect(m.linesAdded).toBe(5);
    expect(m.filesModified).toBe(1);
  });

  it("detects git operations from Bash commands", () => {
    const events = [
      makeEvent({ toolName: "Bash", tool_input: { command: "git commit -m 'fix'" } }),
      makeEvent({ toolName: "Bash", tool_input: { command: "git push origin main" } }),
      makeEvent({ toolName: "Bash", tool_input: { command: "npm test" } }),
    ];
    const m = deriveMetrics(events);
    expect(m.gitOperations).toBe(2);
    expect(m.gitOpsBreakdown.commit).toBe(1);
    expect(m.gitOpsBreakdown.push).toBe(1);
  });

  it("counts MCP calls by tool name prefix", () => {
    const events = [
      makeEvent({ toolName: "mcp__slack__send_message" }),
      makeEvent({ toolName: "mcp__github__create_issue" }),
      makeEvent({ toolName: "Bash", tool_input: { command: "echo hi" } }),
    ];
    const m = deriveMetrics(events);
    expect(m.mcpCalls).toBe(2);
  });

  it("tracks unique modified files", () => {
    const events = [
      makeEvent({ toolName: "Edit", tool_input: { file_path: "/a.ts", old_string: "x", new_string: "y" } }),
      makeEvent({ toolName: "Edit", tool_input: { file_path: "/a.ts", old_string: "y", new_string: "z" } }),
      makeEvent({ toolName: "Write", tool_input: { file_path: "/b.ts", content: "new" } }),
    ];
    const m = deriveMetrics(events);
    expect(m.filesModified).toBe(2);
  });

  it("computes success rate", () => {
    const events = [
      makeEvent({ toolName: "Bash", hookEventName: "PreToolUse" }),
      makeEvent({ toolName: "Bash", hookEventName: "PreToolUse" }),
      makeEvent({ toolName: "Bash", hookEventName: "PreToolUse" }),
      makeEvent({ toolName: "Bash", hookEventName: "PostToolUseFailure" }),
    ];
    const m = deriveMetrics(events);
    expect(m.totalToolCalls).toBe(3);
    expect(m.failedToolCalls).toBe(1);
    expect(m.successRate).toBe(67);
  });

  it("returns 100% success rate with no events", () => {
    expect(deriveMetrics([]).successRate).toBe(100);
  });

  it("only counts PreToolUse for tool calls (not PostToolUse)", () => {
    const events = [
      makeEvent({ toolName: "Read", hookEventName: "PreToolUse" }),
      makeEvent({ toolName: "Read", hookEventName: "PostToolUse" }),
    ];
    expect(deriveMetrics(events).totalToolCalls).toBe(1);
  });
});
