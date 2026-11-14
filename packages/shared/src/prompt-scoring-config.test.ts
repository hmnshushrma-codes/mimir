import { describe, it, expect } from "vitest";
import { enhanceScore, generateCoachingTips, SCORING_DIMENSIONS } from "./prompt-scoring-config.js";
import { assessPrompt } from "./prompt-quality.js";
import type { PromptOutcome } from "./prompt-outcomes.js";

function fakeOutcome(overrides: Partial<PromptOutcome> = {}): PromptOutcome {
  return {
    promptText: "test prompt",
    sessionId: "s1",
    timestamp: "2026-01-01T00:00:00Z",
    wallTimeMs: 10000,
    tokenEstimate: null,
    apiCalls: 5,
    toolCalls: 5,
    failedToolCalls: 0,
    filesRead: 2,
    filesEdited: 1,
    filesReRead: 0,
    subagentsSpawned: 0,
    askedClarification: false,
    followedByCorrection: false,
    costEstimate: null,
    ...overrides,
  };
}

describe("SCORING_DIMENSIONS", () => {
  it("has exactly 8 dimensions", () => {
    expect(SCORING_DIMENSIONS).toHaveLength(8);
  });

  it("all have key, label, weight, description", () => {
    for (const d of SCORING_DIMENSIONS) {
      expect(d.key).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.weight).toBeGreaterThan(0);
      expect(d.description).toBeTruthy();
    }
  });
});

describe("enhanceScore", () => {
  it("produces 8 dimension scores from assessPrompt output", () => {
    const assessment = assessPrompt("s1", "Fix the login bug in src/auth.ts by checking the token expiry");
    const enhanced = enhanceScore(assessment);
    expect(enhanced.dimensions).toHaveLength(8);
    expect(enhanced.overallScore).toBeGreaterThanOrEqual(0);
    expect(enhanced.overallScore).toBeLessThanOrEqual(100);
  });

  it("is deterministic — same input gives same output", () => {
    const a1 = enhanceScore(assessPrompt("s1", "fix the bug"));
    const a2 = enhanceScore(assessPrompt("s1", "fix the bug"));
    expect(a1.overallScore).toBe(a2.overallScore);
    expect(a1.dimensions.map((d) => d.score)).toEqual(a2.dimensions.map((d) => d.score));
  });

  it("scores a good prompt higher than a vague one", () => {
    const good = enhanceScore(assessPrompt("s1", "Fix the login bug in src/auth.ts — the JWT token expiry check fails when the clock skews. Only change the validateToken function. Tests must pass."));
    const vague = enhanceScore(assessPrompt("s1", "fix it"));
    expect(good.overallScore).toBeGreaterThan(vague.overallScore);
  });

  it("penalizes efficiency when outcome has failures and corrections", () => {
    const assessment = assessPrompt("s1", "add a feature");
    const goodOutcome = fakeOutcome({ failedToolCalls: 0, followedByCorrection: false });
    const badOutcome = fakeOutcome({ failedToolCalls: 3, followedByCorrection: true });
    const good = enhanceScore(assessment, goodOutcome);
    const bad = enhanceScore(assessment, badOutcome);
    const effGood = good.dimensions.find((d) => d.key === "efficiency")!.score;
    const effBad = bad.dimensions.find((d) => d.key === "efficiency")!.score;
    expect(effGood).toBeGreaterThan(effBad);
  });

  it("detects boilerplate for reuse score", () => {
    const withBoilerplate = enhanceScore(assessPrompt("s1", "always use typescript, use pnpm not npm, don't add comments, keep it simple, fix the bug"));
    const withoutBoilerplate = enhanceScore(assessPrompt("s1", "fix the bug in src/auth.ts"));
    const reuseWith = withBoilerplate.dimensions.find((d) => d.key === "reuse")!.score;
    const reuseWithout = withoutBoilerplate.dimensions.find((d) => d.key === "reuse")!.score;
    expect(reuseWith).toBeLessThan(reuseWithout);
  });

  it("adds outcome notes for corrections and failures", () => {
    const assessment = assessPrompt("s1", "fix the bug");
    const outcome = fakeOutcome({ followedByCorrection: true, failedToolCalls: 2, filesReRead: 3 });
    const enhanced = enhanceScore(assessment, outcome);
    expect(enhanced.outcomeNotes.length).toBeGreaterThan(0);
    expect(enhanced.outcomeNotes.some((n) => n.includes("correction"))).toBe(true);
  });

  it("labels score as heuristic in dimension reasons (no LLM claims)", () => {
    const enhanced = enhanceScore(assessPrompt("s1", "hello"));
    // Efficiency without outcome data should mention heuristic
    const eff = enhanced.dimensions.find((d) => d.key === "efficiency")!;
    expect(eff.reason).toContain("heuristic");
  });
});

describe("generateCoachingTips", () => {
  it("returns tips when enough data", () => {
    const scores = Array.from({ length: 5 }, (_, i) =>
      enhanceScore(assessPrompt(`s${i}`, "fix it"))
    );
    const outcomes = Array.from({ length: 5 }, () => fakeOutcome());
    const tips = generateCoachingTips(scores, outcomes);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it("returns fallback with too few prompts", () => {
    const tips = generateCoachingTips([enhanceScore(assessPrompt("s1", "fix"))], [fakeOutcome()]);
    expect(tips[0]).toContain("more prompts");
  });
});
