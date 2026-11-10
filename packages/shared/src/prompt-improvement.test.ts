import { describe, expect, it } from "vitest";
import { generatePromptRecommendation } from "./prompt-improvement.js";
import type { SessionAnalytics } from "./analytics.js";
import { EMPTY_TOKEN_USAGE } from "./analytics.js";

const goodSession: SessionAnalytics = {
  sessionId: "s1", projectId: "p1", startedAt: "2026-01-01T00:00:00Z",
  endedAt: "2026-01-01T00:10:00Z", durationMs: 600000,
  agentCount: 2, subagentCount: 1, toolCallCount: 15,
  successfulToolCalls: 14, failedToolCalls: 1, permissionRequests: 0,
  prompt: "Fix auth", tokenUsage: EMPTY_TOKEN_USAGE, cost: null,
};

const badSession: SessionAnalytics = {
  sessionId: "s2", projectId: "p1", startedAt: "2026-01-01T00:00:00Z",
  endedAt: "2026-01-01T01:00:00Z", durationMs: 3600000,
  agentCount: 4, subagentCount: 3, toolCallCount: 50,
  successfulToolCalls: 25, failedToolCalls: 25, permissionRequests: 3,
  prompt: "fix stuff", tokenUsage: EMPTY_TOKEN_USAGE, cost: null,
};

describe("generatePromptRecommendation", () => {
  it("generates suggestions for a vague prompt", () => {
    const rec = generatePromptRecommendation("s1", "fix it");
    expect(rec.qualityScore).toBeLessThan(40);
    expect(rec.suggestions.length).toBeGreaterThan(0);
    expect(rec.suggestions.some((s) => s.priority === "high")).toBe(true);
    expect(rec.improvedPrompt).not.toBeNull();
    expect(rec.originalPrompt).toBe("fix it");
  });

  it("generates few/no suggestions for a detailed prompt", () => {
    const rec = generatePromptRecommendation("s1",
      "Fix the authentication bug in `src/auth.ts` where `validateToken` " +
      "returns null instead of throwing AuthenticationError for expired JWT tokens. " +
      "Only modify auth.ts and auth.test.ts. Don't touch the middleware. " +
      "Must maintain backward compatibility. Expected: expired tokens return 401. " +
      "Run `pnpm test` and `pnpm typecheck` to verify. Done when all tests pass."
    );
    expect(rec.qualityScore).toBeGreaterThan(55);
    const highPriority = rec.suggestions.filter((s) => s.priority === "high");
    expect(highPriority.length).toBeLessThanOrEqual(1);
  });

  it("preserves the original prompt — never modifies it", () => {
    const original = "maybe fix something";
    const rec = generatePromptRecommendation("s1", original);
    expect(rec.originalPrompt).toBe(original);
  });

  it("returns null improvedPrompt when prompt is already good", () => {
    const rec = generatePromptRecommendation("s1",
      "Fix the null check in `validateToken` in `src/auth.ts`. " +
      "Run `pnpm test`. Done when tests pass. Only modify auth module."
    );
    // If all high-priority suggestions are already addressed
    if (rec.suggestions.filter((s) => s.priority === "high").length === 0) {
      expect(rec.improvedPrompt).toBeNull();
    }
  });

  it("correlates vague prompt with bad session outcomes", () => {
    const rec = generatePromptRecommendation("s2", "fix stuff", badSession);
    expect(rec.outcomeCorrelation).not.toBeNull();
    expect(rec.outcomeCorrelation!.failedToolCalls).toBe(25);
    expect(rec.outcomeCorrelation!.observations.length).toBeGreaterThan(0);
    // Should observe high failure rate + low prompt score
    expect(rec.outcomeCorrelation!.observations.some((o) => o.includes("failure rate"))).toBe(true);
  });

  it("notes missing scope when many subagents spawned", () => {
    const rec = generatePromptRecommendation("s2", "do things", badSession);
    expect(rec.outcomeCorrelation).not.toBeNull();
    expect(rec.outcomeCorrelation!.observations.some((o) => o.includes("scope"))).toBe(true);
  });

  it("returns null correlation when no session analytics provided", () => {
    const rec = generatePromptRecommendation("s1", "fix it");
    expect(rec.outcomeCorrelation).toBeNull();
  });

  it("suggestions have correct structure", () => {
    const rec = generatePromptRecommendation("s1", "fix");
    for (const s of rec.suggestions) {
      expect(s.dimension).toBeTruthy();
      expect(typeof s.currentScore).toBe("number");
      expect(s.suggestion).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(s.priority);
    }
  });

  it("handles empty prompt", () => {
    const rec = generatePromptRecommendation("s1", "");
    expect(rec.qualityScore).toBeLessThan(30);
    expect(rec.suggestions.length).toBeGreaterThan(0);
  });
});
