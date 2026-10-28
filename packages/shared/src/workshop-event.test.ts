import { describe, expect, it } from "vitest";
import { deriveAgentEvent, extractTarget, normalizeToWorkshopEvent, stripSystemMessages, MAIN_AGENT_ID } from "./workshop-event.js";
import type { HookEventEnvelope } from "./raw-hook-events.js";

const TS = "2026-10-27T07:00:00.000Z";

function envelope(payload: Record<string, unknown>): HookEventEnvelope {
  return { ...payload, timestamp: TS } as HookEventEnvelope;
}

describe("normalizeToWorkshopEvent", () => {
  it("normalizes a main-session PreToolUse (Bash) event", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_use_id: "toolu_01ABC123"
    });

    const event = normalizeToWorkshopEvent(e);
    expect(event.agentId).toBe(MAIN_AGENT_ID);
    expect(event.category).toBe("shell");
    expect(event.toolName).toBe("Bash");
    expect(event.toolUseId).toBe("toolu_01ABC123");
    expect(event.target).toBe("npm test");
  });

  it("normalizes a subagent-scoped PostToolUse event with agent_id/agent_type", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "PostToolUse",
      tool_name: "Read",
      tool_input: { file_path: "/repo/src/index.ts" },
      tool_output: "...",
      tool_use_id: "toolu_02DEF456",
      agent_id: "subagent-id-123",
      agent_type: "Explore"
    });

    const event = normalizeToWorkshopEvent(e);
    expect(event.agentId).toBe("subagent-id-123");
    expect(event.agentType).toBe("Explore");
    expect(event.category).toBe("read");
    expect(event.target).toBe("/repo/src/index.ts");
  });

  it("falls back to category 'other' for non-tool events", () => {
    const e = envelope({ session_id: "abc123", hook_event_name: "SessionStart", source: "startup" });
    const event = normalizeToWorkshopEvent(e);
    expect(event.category).toBe("other");
    expect(event.toolName).toBeNull();
  });

  it("extracts the message into target for Notification events", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "Notification",
      notification_type: "permission_prompt",
      message: "Claude needs your attention"
    });
    const event = normalizeToWorkshopEvent(e);
    expect(event.target).toBe("Claude needs your attention");
  });

  it("falls back to notification_type when a Notification has no message", () => {
    const e = envelope({ session_id: "abc123", hook_event_name: "Notification", notification_type: "idle_prompt" });
    const event = normalizeToWorkshopEvent(e);
    expect(event.target).toBe("idle_prompt");
  });
});

describe("deriveAgentEvent", () => {
  it("maps SessionStart to SPAWNED", () => {
    const e = envelope({ session_id: "abc123", hook_event_name: "SessionStart", source: "startup" });
    expect(deriveAgentEvent(e)).toEqual({ type: "SPAWNED", at: TS });
  });

  it("maps SubagentStart to SPAWNED", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "SubagentStart",
      agent_id: "subagent-id-123",
      agent_type: "Explore",
      task_description: "Explore the codebase"
    });
    expect(deriveAgentEvent(e)).toEqual({ type: "SPAWNED", at: TS });
  });

  it("maps PreToolUse to TOOL_STARTED with the right category", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "a.ts" },
      tool_use_id: "toolu_1"
    });
    expect(deriveAgentEvent(e)).toEqual({ type: "TOOL_STARTED", category: "write", at: TS });
  });

  it("maps PostToolUse to TOOL_SUCCEEDED", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_output: "ok",
      tool_use_id: "toolu_1"
    });
    expect(deriveAgentEvent(e)).toEqual({ type: "TOOL_SUCCEEDED", at: TS });
  });

  it("maps PostToolUseFailure to TOOL_FAILED with the error", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: { command: "false" },
      tool_use_id: "toolu_1",
      error: "exit code 1"
    });
    expect(deriveAgentEvent(e)).toEqual({ type: "TOOL_FAILED", error: "exit code 1", at: TS });
  });

  it("maps a permission_prompt Notification to PERMISSION_REQUIRED", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "Notification",
      notification_type: "permission_prompt",
      message: "..."
    });
    expect(deriveAgentEvent(e)).toEqual({ type: "PERMISSION_REQUIRED", at: TS });
  });

  it("ignores non-permission_prompt Notifications", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "Notification",
      notification_type: "idle_prompt",
      message: "..."
    });
    expect(deriveAgentEvent(e)).toBeNull();
  });

  it("maps SubagentStop and Stop and SessionEnd to STOPPED", () => {
    const subagentStop = envelope({
      session_id: "abc123",
      hook_event_name: "SubagentStop",
      agent_id: "subagent-id-123",
      agent_type: "Explore",
      exit_reason: "completed"
    });
    const stop = envelope({ session_id: "abc123", hook_event_name: "Stop" });
    const sessionEnd = envelope({ session_id: "abc123", hook_event_name: "SessionEnd", reason: "other" });

    expect(deriveAgentEvent(subagentStop)).toEqual({ type: "STOPPED", at: TS });
    expect(deriveAgentEvent(stop)).toEqual({ type: "STOPPED", at: TS });
    expect(deriveAgentEvent(sessionEnd)).toEqual({ type: "STOPPED", at: TS });
  });

  it("returns null for events with no lifecycle meaning (e.g. UserPromptSubmit)", () => {
    const e = envelope({ session_id: "abc123", hook_event_name: "UserPromptSubmit", prompt: "hi" });
    expect(deriveAgentEvent(e)).toBeNull();
  });
});

describe("extractTarget", () => {
  it("prefers file_path for file tools", () => {
    expect(extractTarget("Edit", { file_path: "a.ts", old_string: "x" })).toBe("a.ts");
  });

  it("uses command for Bash", () => {
    expect(extractTarget("Bash", { command: "ls -la" })).toBe("ls -la");
  });

  it("returns null when there's nothing tool-ish to show", () => {
    expect(extractTarget(null, { command: "ls" })).toBeNull();
    expect(extractTarget("Bash", undefined)).toBeNull();
  });
});

describe("stripSystemMessages", () => {
  it("returns null for null input", () => {
    expect(stripSystemMessages(null)).toBeNull();
  });

  it("returns the string unchanged when no system tags are present", () => {
    expect(stripSystemMessages("fix the bug in auth.ts")).toBe("fix the bug in auth.ts");
  });

  it("strips <task-notification> tags and their content", () => {
    const input = '<task-notification>\n<task-id>abc</task-id>\n<status>completed</status>\n</task-notification>\nfix the bug';
    expect(stripSystemMessages(input)).toBe("fix the bug");
  });

  it("strips <system-reminder> tags and their content", () => {
    const input = 'do the thing\n<system-reminder>\nsome internal stuff\n</system-reminder>';
    expect(stripSystemMessages(input)).toBe("do the thing");
  });

  it("strips multiple system tags from the same prompt", () => {
    const input = '<task-notification>...</task-notification>\n<system-reminder>...</system-reminder>\nhello';
    expect(stripSystemMessages(input)).toBe("hello");
  });

  it("returns null when the entire prompt is system tags", () => {
    const input = '<task-notification>\n<task-id>abc</task-id>\n</task-notification>';
    expect(stripSystemMessages(input)).toBeNull();
  });

  it("filters system tags in UserPromptSubmit normalization", () => {
    const e = envelope({
      session_id: "abc123",
      hook_event_name: "UserPromptSubmit",
      prompt: '<task-notification><task-id>123</task-id></task-notification>\nplease fix the tests'
    });
    const event = normalizeToWorkshopEvent(e);
    expect(event.target).toBe("please fix the tests");
  });
});
