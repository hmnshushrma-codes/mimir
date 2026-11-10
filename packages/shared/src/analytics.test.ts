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
