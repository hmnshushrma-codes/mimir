import { describe, expect, it, beforeEach } from "vitest";
import { detectKnowledgeGaps, resetGapIds } from "./knowledge-gaps.js";
import type { ToolCallAnalytics } from "./analytics.js";
import { WorkshopModel } from "./model.js";
import { buildToolCallAnalytics } from "./analytics-builders.js";

function tc(overrides: Partial<ToolCallAnalytics>): ToolCallAnalytics {
  return {
    toolUseId: "tu-" + Math.random().toString(36).slice(2, 6),
    sessionId: "s1", agentId: "main", toolName: "Read", category: "read",
    status: "succeeded", target: "src/app.ts",
    startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:00:01Z",
    durationMs: 1000, isRetry: false,
    ...overrides,
  };
}

beforeEach(() => resetGapIds());

describe("detectKnowledgeGaps — repeated rediscovery", () => {
  it("detects file read by 2+ agents", () => {
    const calls = [
      tc({ target: "src/auth.ts", agentId: "main" }),
      tc({ target: "src/auth.ts", agentId: "agent-1" }),
    ];
    const gaps = detectKnowledgeGaps(calls, "s1");
    const rediscovery = gaps.filter((g) => g.gapType === "repeated_rediscovery");
    expect(rediscovery).toHaveLength(1);
    expect(rediscovery[0].requiresApproval).toBe(true);
    expect(rediscovery[0].recommendation).toContain("CLAUDE.md");
  });

  it("does not flag file read by only 1 agent", () => {
    const calls = [
      tc({ target: "src/auth.ts", agentId: "main" }),
      tc({ target: "src/auth.ts", agentId: "main" }),
    ];
    const gaps = detectKnowledgeGaps(calls, "s1");
    expect(gaps.filter((g) => g.gapType === "repeated_rediscovery")).toHaveLength(0);
  });
});

describe("detectKnowledgeGaps — recurring errors", () => {
  it("detects 3+ failures on the same target", () => {
    const calls = [
      tc({ target: "npm test", toolName: "Bash", status: "failed", toolUseId: "f1" }),
      tc({ target: "npm test", toolName: "Bash", status: "failed", toolUseId: "f2" }),
      tc({ target: "npm test", toolName: "Bash", status: "failed", toolUseId: "f3" }),
    ];
    const gaps = detectKnowledgeGaps(calls, "s1");
    const errors = gaps.filter((g) => g.gapType === "recurring_error");
    expect(errors).toHaveLength(1);
    expect(errors[0].evidence).toEqual(["f1", "f2", "f3"]);
    expect(errors[0].requiresApproval).toBe(true);
  });

  it("does not flag < 3 failures", () => {
    const calls = [
      tc({ target: "npm test", status: "failed" }),
      tc({ target: "npm test", status: "failed" }),
    ];
    const gaps = detectKnowledgeGaps(calls, "s1");
    expect(gaps.filter((g) => g.gapType === "recurring_error")).toHaveLength(0);
  });
});

describe("detectKnowledgeGaps — missing rules", () => {
  it("detects config files read 3+ times", () => {
    const calls = [
      tc({ target: "tsconfig.json" }),
      tc({ target: "tsconfig.json" }),
      tc({ target: "tsconfig.json" }),
    ];
    const gaps = detectKnowledgeGaps(calls, "s1");
    const rules = gaps.filter((g) => g.gapType === "missing_rule");
    expect(rules).toHaveLength(1);
    expect(rules[0].recommendation).toContain("CLAUDE.md");
  });

  it("detects eslint config reads", () => {
    const calls = Array.from({ length: 3 }, () => tc({ target: ".eslintrc.json" }));
    const gaps = detectKnowledgeGaps(calls, "s1");
    expect(gaps.filter((g) => g.gapType === "missing_rule")).toHaveLength(1);
  });
});

describe("integration — knowledge gaps from real events", () => {
  it("detects gaps from a multi-agent session", () => {
    const model = new WorkshopModel();
    const T = "2026-01-15T10:00:00.000Z";
    const ts = (ms: number) => new Date(Date.parse(T) + ms).toISOString();

    model.ingest({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", timestamp: ts(0) });
    model.ingest({ session_id: "s1", hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "Explore", task_description: "find auth", timestamp: ts(500) });

    // Main agent reads auth.ts
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/auth.ts" }, tool_use_id: "r1", timestamp: ts(1000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "r1", timestamp: ts(1100) });

    // Subagent also reads auth.ts — rediscovery
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/auth.ts" }, tool_use_id: "r2", agent_id: "a1", agent_type: "Explore", timestamp: ts(2000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "r2", agent_id: "a1", agent_type: "Explore", timestamp: ts(2100) });

    const session = model.getSession("s1")!;
    const toolCalls = buildToolCallAnalytics(session);
    const gaps = detectKnowledgeGaps(toolCalls, "s1");

    // Should detect auth.ts read by main + a1 = rediscovery
    const rediscovery = gaps.filter((g) => g.gapType === "repeated_rediscovery");
    expect(rediscovery.length).toBeGreaterThanOrEqual(1);
    expect(rediscovery[0].description).toContain("auth.ts");
    expect(rediscovery[0].requiresApproval).toBe(true);
  });
});
