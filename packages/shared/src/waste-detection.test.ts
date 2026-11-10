import { describe, expect, it, beforeEach } from "vitest";
import { detectWaste, resetWasteIds } from "./waste-detection.js";
import type { ToolCallAnalytics } from "./analytics.js";
import { WorkshopModel } from "./model.js";
import { buildToolCallAnalytics } from "./analytics-builders.js";

function tc(overrides: Partial<ToolCallAnalytics>): ToolCallAnalytics {
  return {
    toolUseId: "tu-" + Math.random().toString(36).slice(2, 6),
    sessionId: "s1",
    agentId: "main",
    toolName: "Read",
    category: "read",
    status: "succeeded",
    target: "src/app.ts",
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:00:01Z",
    durationMs: 1000,
    isRetry: false,
    ...overrides,
  };
}

beforeEach(() => resetWasteIds());

describe("detectWaste — repeated tool calls", () => {
  it("detects 3+ calls to the same tool+target as probable waste", () => {
    // Use Write (not Read) to avoid also triggering redundant_file_read
    const calls = [
      tc({ toolUseId: "r1", toolName: "Write", category: "write" }),
      tc({ toolUseId: "r2", toolName: "Write", category: "write" }),
      tc({ toolUseId: "r3", toolName: "Write", category: "write" }),
    ];
    const findings = detectWaste(calls, "s1");
    const repeated = findings.filter((f) => f.category === "repeated_tool_call");
    expect(repeated).toHaveLength(1);
    expect(repeated[0].confidence).toBe("probable");
    expect(repeated[0].evidence).toEqual(["r1", "r2", "r3"]);
  });

  it("detects 5+ calls as confirmed waste", () => {
    const calls = Array.from({ length: 5 }, (_, i) => tc({ toolUseId: `r${i}`, toolName: "Write", category: "write" }));
    const findings = detectWaste(calls, "s1");
    const repeated = findings.find((f) => f.category === "repeated_tool_call");
    expect(repeated).toBeDefined();
    expect(repeated!.confidence).toBe("confirmed");
  });

  it("does not flag 2 calls as waste", () => {
    const calls = [tc({ toolUseId: "r1" }), tc({ toolUseId: "r2" })];
    const findings = detectWaste(calls, "s1");
    const repeated = findings.filter((f) => f.category === "repeated_tool_call");
    expect(repeated).toHaveLength(0);
  });

  it("does not flag calls with different targets", () => {
    const calls = [
      tc({ toolUseId: "r1", target: "a.ts" }),
      tc({ toolUseId: "r2", target: "b.ts" }),
      tc({ toolUseId: "r3", target: "c.ts" }),
    ];
    const findings = detectWaste(calls, "s1");
    const repeated = findings.filter((f) => f.category === "repeated_tool_call");
    expect(repeated).toHaveLength(0);
  });
});

describe("detectWaste — redundant file reads", () => {
  it("detects same file read 2+ times by the same agent", () => {
    const calls = [
      tc({ toolUseId: "r1", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
      tc({ toolUseId: "r2", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
    ];
    const findings = detectWaste(calls, "s1");
    const reads = findings.filter((f) => f.category === "redundant_file_read");
    expect(reads).toHaveLength(1);
    expect(reads[0].confidence).toBe("potential");
  });

  it("flags 3+ reads as confirmed", () => {
    const calls = [
      tc({ toolUseId: "r1", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
      tc({ toolUseId: "r2", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
      tc({ toolUseId: "r3", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
    ];
    const findings = detectWaste(calls, "s1");
    const reads = findings.filter((f) => f.category === "redundant_file_read");
    expect(reads[0].confidence).toBe("confirmed");
  });

  it("does not flag reads by different agents", () => {
    const calls = [
      tc({ toolUseId: "r1", toolName: "Read", target: "src/app.ts", agentId: "a1" }),
      tc({ toolUseId: "r2", toolName: "Read", target: "src/app.ts", agentId: "a2" }),
    ];
    const findings = detectWaste(calls, "s1");
    const reads = findings.filter((f) => f.category === "redundant_file_read");
    expect(reads).toHaveLength(0);
  });
});

describe("detectWaste — failed retries", () => {
  it("detects 2+ consecutive failures on the same tool+target", () => {
    const calls = [
      tc({ toolUseId: "f1", toolName: "Bash", target: "npm test", status: "failed", startedAt: "2026-01-01T00:00:00Z" }),
      tc({ toolUseId: "f2", toolName: "Bash", target: "npm test", status: "failed", startedAt: "2026-01-01T00:00:05Z" }),
    ];
    const findings = detectWaste(calls, "s1");
    const retries = findings.filter((f) => f.category === "failed_retry");
    expect(retries).toHaveLength(1);
    expect(retries[0].confidence).toBe("confirmed");
    expect(retries[0].evidence).toEqual(["f1", "f2"]);
  });

  it("resets consecutive count after a success", () => {
    const calls = [
      tc({ toolUseId: "f1", toolName: "Bash", target: "npm test", status: "failed", startedAt: "2026-01-01T00:00:00Z" }),
      tc({ toolUseId: "s1", toolName: "Bash", target: "npm test", status: "succeeded", startedAt: "2026-01-01T00:00:05Z" }),
      tc({ toolUseId: "f2", toolName: "Bash", target: "npm test", status: "failed", startedAt: "2026-01-01T00:00:10Z" }),
    ];
    const findings = detectWaste(calls, "s1");
    const retries = findings.filter((f) => f.category === "failed_retry");
    // Only 1 failure after success — not consecutive
    expect(retries).toHaveLength(0);
  });
});

describe("detectWaste — sorting", () => {
  it("returns findings sorted by confidence (confirmed first)", () => {
    const calls = [
      // 5 repeated reads → confirmed
      ...Array.from({ length: 5 }, (_, i) => tc({ toolUseId: `rep${i}`, target: "x.ts" })),
      // 2 redundant reads → potential (separate target)
      tc({ toolUseId: "rd1", toolName: "Read", target: "y.ts", agentId: "a1" }),
      tc({ toolUseId: "rd2", toolName: "Read", target: "y.ts", agentId: "a1" }),
    ];
    const findings = detectWaste(calls, "s1");
    expect(findings.length).toBeGreaterThanOrEqual(2);
    // First finding should be confirmed, last should be potential or later
    for (let i = 1; i < findings.length; i++) {
      const order = { confirmed: 0, probable: 1, potential: 2, insufficient: 3 };
      expect(order[findings[i].confidence]).toBeGreaterThanOrEqual(order[findings[i - 1].confidence]);
    }
  });
});

describe("integration — waste detection from real model events", () => {
  it("detects retries from a session with failed → retry pattern", () => {
    const model = new WorkshopModel();
    const T = "2026-01-15T10:00:00.000Z";
    const ts = (ms: number) => new Date(Date.parse(T) + ms).toISOString();

    model.ingest({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", timestamp: ts(0) });
    model.ingest({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "fix", timestamp: ts(100) });

    // 3 consecutive failed Bash calls to same target
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "t1", timestamp: ts(1000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: "t1", timestamp: ts(2000) });
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "t2", timestamp: ts(3000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: "t2", timestamp: ts(4000) });
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "t3", timestamp: ts(5000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: "t3", timestamp: ts(6000) });

    // Finally succeeds
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "t4", timestamp: ts(7000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "pass", tool_use_id: "t4", timestamp: ts(8000) });

    const session = model.getSession("s1")!;
    const toolCalls = buildToolCallAnalytics(session);
    const findings = detectWaste(toolCalls, "s1");

    // Should detect 3 consecutive failures as a confirmed failed_retry
    const retries = findings.filter((f) => f.category === "failed_retry");
    expect(retries.length).toBeGreaterThanOrEqual(1);
    expect(retries[0].confidence).toBe("confirmed");
    expect(retries[0].evidence.length).toBe(3);
  });
});
