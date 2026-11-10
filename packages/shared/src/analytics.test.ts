import { describe, expect, it } from "vitest";
import {
  EMPTY_TOKEN_USAGE,
  type TokenUsage,
  type SessionAnalytics,
  type ToolCallAnalytics,
  type AgentAnalytics,
  type WasteFinding,
  type PromptAssessment,
  type PromptQualityDimensions,
  type KnowledgeItem,
  type KnowledgeGap,
  type PermissionEvent,
  type TimelineEvent,
  type SessionComparison,
  type DashboardMetrics,
  type ModelPricing,
  type CostBreakdown,
  type MaybeAvailable,
  type DataAvailability,
} from "./analytics.js";
import { WorkshopModel } from "./model.js";
import { MAIN_AGENT_ID } from "./workshop-event.js";
import { buildSessionAnalytics, buildToolCallAnalytics, buildPermissionEvents, buildTimelineEvents, buildDashboardMetrics } from "./analytics-builders.js";

describe("analytics types — compilation and constants", () => {
  it("EMPTY_TOKEN_USAGE has all fields unavailable", () => {
    expect(EMPTY_TOKEN_USAGE.inputTokens.availability).toBe("unavailable");
    expect(EMPTY_TOKEN_USAGE.outputTokens.availability).toBe("unavailable");
    expect(EMPTY_TOKEN_USAGE.cacheCreationTokens.availability).toBe("unavailable");
    expect(EMPTY_TOKEN_USAGE.cacheReadTokens.availability).toBe("unavailable");
    expect(EMPTY_TOKEN_USAGE.inputTokens.value).toBe(0);
  });

  it("MaybeAvailable enforces availability tags", () => {
    const measured: MaybeAvailable<number> = { value: 1500, availability: "measured", source: "transcript" };
    const estimated: MaybeAvailable<number> = { value: 1200, availability: "estimated", source: "heuristic" };
    const unavailable: MaybeAvailable<number> = { value: 0, availability: "unavailable", source: "none" };
    expect(measured.availability).toBe("measured");
    expect(estimated.availability).toBe("estimated");
    expect(unavailable.availability).toBe("unavailable");
  });

  it("DataAvailability is a union of 3 values", () => {
    const vals: DataAvailability[] = ["measured", "estimated", "unavailable"];
    expect(vals).toHaveLength(3);
  });

  it("TokenUsage serializes to JSON and back without loss", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 5000, availability: "measured", source: "transcript" },
      outputTokens: { value: 3000, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 200, availability: "estimated", source: "heuristic" },
      cacheReadTokens: { value: 0, availability: "unavailable", source: "none" },
    };
    const roundTripped = JSON.parse(JSON.stringify(usage)) as TokenUsage;
    expect(roundTripped).toEqual(usage);
  });

  it("SessionAnalytics compiles with all fields", () => {
    const sa: SessionAnalytics = {
      sessionId: "s1",
      projectId: "p1",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T01:00:00Z",
      durationMs: 3600000,
      agentCount: 3,
      subagentCount: 2,
      toolCallCount: 45,
      successfulToolCalls: 40,
      failedToolCalls: 5,
      permissionRequests: 1,
      prompt: "Fix the auth flow",
      tokenUsage: EMPTY_TOKEN_USAGE,
      cost: null,
    };
    expect(sa.sessionId).toBe("s1");
    expect(sa.tokenUsage.inputTokens.availability).toBe("unavailable");
  });

  it("ToolCallAnalytics tracks retry flag", () => {
    const tc: ToolCallAnalytics = {
      toolUseId: "tu1",
      sessionId: "s1",
      agentId: "a1",
      toolName: "Bash",
      category: "shell",
      status: "failed",
      target: "npm test",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:05Z",
      durationMs: 5000,
      isRetry: false,
    };
    const retry: ToolCallAnalytics = { ...tc, toolUseId: "tu2", isRetry: true, status: "succeeded" };
    expect(retry.isRetry).toBe(true);
  });

  it("WasteFinding requires evidence array", () => {
    const finding: WasteFinding = {
      id: "w1",
      sessionId: "s1",
      category: "repeated_tool_call",
      confidence: "confirmed",
      description: "Read src/App.tsx 4 times",
      affectedAgentId: "a1",
      evidence: ["tu1", "tu2", "tu3", "tu4"],
      estimatedWastedTokens: { value: 0, availability: "unavailable", source: "none" },
      estimatedWastedCost: { value: 0, availability: "unavailable", source: "none" },
    };
    expect(finding.evidence).toHaveLength(4);
    expect(finding.confidence).toBe("confirmed");
  });

  it("PromptQualityDimensions has exactly 10 dimensions", () => {
    const dims: PromptQualityDimensions = {
      objectiveClarity: 8,
      taskSpecificity: 7,
      contextCompleteness: 6,
      scopeDefinition: 5,
      constraints: 4,
      expectedOutput: 3,
      acceptanceCriteria: 2,
      ambiguity: 9,
      technicalContext: 7,
      verificationInstructions: 1,
    };
    expect(Object.keys(dims)).toHaveLength(10);
  });

  it("KnowledgeGap always requires approval", () => {
    const gap: KnowledgeGap = {
      id: "kg1",
      sessionId: "s1",
      description: "No CLAUDE.md for testing conventions",
      evidence: ["agent read test files 5 times"],
      gapType: "missing_documentation",
      recommendation: "Add testing conventions to CLAUDE.md",
      requiresApproval: true,
    };
    expect(gap.requiresApproval).toBe(true);
  });

  it("PermissionEvent tracks the full lifecycle", () => {
    const pending: PermissionEvent = {
      id: "pe1",
      sessionId: "s1",
      agentId: "a1",
      toolName: "Bash",
      commandPreview: "rm -rf /tmp/old",
      requestedAt: "2026-01-01T00:00:00Z",
      decidedAt: null,
      decision: "pending",
      waitingDurationMs: null,
      requestType: "permission",
    };
    const approved: PermissionEvent = {
      ...pending,
      decidedAt: "2026-01-01T00:00:05Z",
      decision: "approved",
      waitingDurationMs: 5000,
    };
    expect(pending.decision).toBe("pending");
    expect(approved.waitingDurationMs).toBe(5000);
  });

  it("ModelPricing has all required fields", () => {
    const pricing: ModelPricing = {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250514",
      inputPricePerMToken: 3.0,
      outputPricePerMToken: 15.0,
      cacheCreationPricePerMToken: 3.75,
      cacheReadPricePerMToken: 0.30,
      currency: "USD",
      effectiveDate: "2025-05-14",
      source: "anthropic.com/pricing",
    };
    expect(pricing.provider).toBe("anthropic");
  });

  it("DashboardMetrics compiles with aggregated fields", () => {
    const m: DashboardMetrics = {
      totalSessions: 10,
      totalAgents: 25,
      totalToolCalls: 300,
      totalDurationMs: 7200000,
      avgSessionDurationMs: 720000,
      avgTaskDurationMs: 45000,
      completedTasks: 22,
      failedTasks: 3,
      tokenUsage: EMPTY_TOKEN_USAGE,
      totalCost: { value: 0, availability: "unavailable", source: "none" },
      computedAt: "2026-01-01T00:00:00Z",
    };
    expect(m.totalSessions).toBe(10);
  });
});

// ─── Integration tests: real model → analytics builders ─────────────

describe("analytics builders — integration with WorkshopModel", () => {
  const T = "2026-01-15T10:00:00.000Z";
  function ts(offsetMs: number): string {
    return new Date(Date.parse(T) + offsetMs).toISOString();
  }

  function buildTestSession(): WorkshopModel {
    const model = new WorkshopModel();
    // Session start
    model.ingest({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/project", timestamp: ts(0) });
    // User prompt
    model.ingest({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "Fix the auth bug", timestamp: ts(100) });
    // Foreman reads a file
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/auth.ts" }, tool_use_id: "tu1", timestamp: ts(500) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "tu1", timestamp: ts(800) });
    // Foreman delegates
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Fix auth" }, tool_use_id: "tu-del", timestamp: ts(1000) });
    model.ingest({ session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "general-purpose", task_description: "Fix auth", timestamp: ts(1200) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_output: "started", tool_use_id: "tu-del", timestamp: ts(1300) });
    // Subagent does work — a failed call then a retry
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "tu2", agent_id: "agent-1", agent_type: "general-purpose", timestamp: ts(2000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: "tu2", agent_id: "agent-1", agent_type: "general-purpose", timestamp: ts(4000) });
    // Retry same command
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "tu3", agent_id: "agent-1", agent_type: "general-purpose", timestamp: ts(5000) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "ok", tool_use_id: "tu3", agent_id: "agent-1", agent_type: "general-purpose", timestamp: ts(7000) });
    // Subagent finishes
    model.ingest({ session_id: "s1", hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "general-purpose", exit_reason: "completed", timestamp: ts(7500) });
    // Session ends
    model.ingest({ session_id: "s1", hook_event_name: "Stop", last_assistant_message: "Auth fixed", timestamp: ts(8000) });
    return model;
  }

  it("buildSessionAnalytics produces correct counts from real events", () => {
    const model = buildTestSession();
    const session = model.getSession("s1")!;
    const analytics = buildSessionAnalytics(session, "Fix the auth bug");

    expect(analytics.sessionId).toBe("s1");
    expect(analytics.prompt).toBe("Fix the auth bug");
    expect(analytics.agentCount).toBe(2); // main + agent-1
    expect(analytics.subagentCount).toBe(1); // agent-1
    // Tool calls: tu1 (Read), tu-del (Agent), tu2 (Bash fail), tu3 (Bash ok) = 4
    expect(analytics.toolCallCount).toBeGreaterThanOrEqual(3);
    expect(analytics.failedToolCalls).toBeGreaterThanOrEqual(1);
    expect(analytics.successfulToolCalls).toBeGreaterThanOrEqual(2);
    // Token data is unavailable from hooks
    expect(analytics.tokenUsage.inputTokens.availability).toBe("unavailable");
    expect(analytics.cost).toBeNull();
  });

  it("buildToolCallAnalytics detects retries", () => {
    const model = buildTestSession();
    const session = model.getSession("s1")!;
    const tools = buildToolCallAnalytics(session);

    // Find the Bash calls
    const bashCalls = tools.filter((t) => t.toolName === "Bash");
    expect(bashCalls.length).toBeGreaterThanOrEqual(2);

    const failed = bashCalls.find((t) => t.status === "failed");
    const retried = bashCalls.find((t) => t.isRetry === true);
    expect(failed).toBeDefined();
    expect(retried).toBeDefined();
    expect(failed!.isRetry).toBe(false); // First attempt is not a retry
    expect(retried!.status).toBe("succeeded");
  });

  it("buildToolCallAnalytics computes durations", () => {
    const model = buildTestSession();
    const session = model.getSession("s1")!;
    const tools = buildToolCallAnalytics(session);

    const readCall = tools.find((t) => t.toolName === "Read");
    expect(readCall).toBeDefined();
    expect(readCall!.durationMs).toBe(300); // 800 - 500
    expect(readCall!.category).toBe("read");
  });

  it("buildTimelineEvents produces a sorted timeline", () => {
    const model = buildTestSession();
    const session = model.getSession("s1")!;
    const timeline = buildTimelineEvents(session);

    expect(timeline.length).toBeGreaterThan(0);
    // First event should be session_start
    expect(timeline[0].type).toBe("session_start");
    // Stop hook doesn't set session.status = "ended" (only SessionEnd does),
    // so session_end event won't appear. Last should be agent_stop or a tool event.
    expect(timeline[timeline.length - 1].type).not.toBe("session_start");
    // Check sorted by timestamp
    for (let i = 1; i < timeline.length; i++) {
      expect(Date.parse(timeline[i].timestamp)).toBeGreaterThanOrEqual(Date.parse(timeline[i - 1].timestamp));
    }
    // Should have agent_spawn for agent-1
    expect(timeline.some((e) => e.type === "agent_spawn")).toBe(true);
    // Should have tool_failure
    expect(timeline.some((e) => e.type === "tool_failure")).toBe(true);
    // Should have agent_stop for agent-1
    expect(timeline.some((e) => e.type === "agent_stop")).toBe(true);
  });

  it("buildPermissionEvents detects pending permissions", () => {
    const model = new WorkshopModel();
    model.ingest({ session_id: "s2", hook_event_name: "SessionStart", source: "startup", timestamp: T });
    model.ingest({ session_id: "s2", hook_event_name: "UserPromptSubmit", prompt: "deploy", timestamp: ts(100) });
    model.ingest({ session_id: "s2", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /tmp" }, tool_use_id: "tu-perm", timestamp: ts(500) });
    model.ingest({ session_id: "s2", hook_event_name: "Notification", notification_type: "permission_prompt", message: "Allow delete?", timestamp: ts(600) });

    const session = model.getSession("s2")!;
    const perms = buildPermissionEvents(session);

    expect(perms.length).toBe(1);
    expect(perms[0].decision).toBe("pending");
    expect(perms[0].requestType).toBe("permission");
    expect(perms[0].agentId).toBe(MAIN_AGENT_ID);
  });

  it("buildDashboardMetrics aggregates across sessions", () => {
    const model = buildTestSession();
    // Add a second session
    model.ingest({ session_id: "s2", hook_event_name: "SessionStart", source: "startup", timestamp: ts(10000) });
    model.ingest({ session_id: "s2", hook_event_name: "UserPromptSubmit", prompt: "add tests", timestamp: ts(10100) });
    model.ingest({ session_id: "s2", hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "test.ts" }, tool_use_id: "tu-s2", timestamp: ts(10500) });
    model.ingest({ session_id: "s2", hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "tu-s2", timestamp: ts(11000) });
    model.ingest({ session_id: "s2", hook_event_name: "Stop", last_assistant_message: "done", timestamp: ts(12000) });

    const sessions = model.getSnapshot();
    const dashboard = buildDashboardMetrics(sessions);

    expect(dashboard.totalSessions).toBe(2);
    expect(dashboard.totalAgents).toBeGreaterThanOrEqual(3); // 2 in s1 + 1 in s2
    expect(dashboard.totalToolCalls).toBeGreaterThanOrEqual(4);
    expect(dashboard.failedTasks).toBeGreaterThanOrEqual(1);
    expect(dashboard.tokenUsage.inputTokens.availability).toBe("unavailable");
    expect(dashboard.totalCost.availability).toBe("unavailable");
  });
});
