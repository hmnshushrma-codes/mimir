import { describe, expect, it } from "vitest";
import { deriveMood, FRUSTRATED_AFTER_ERRORS, type MoodContext } from "./mood.js";

const NOW = "2026-01-01T00:01:00.000Z";

function ctx(overrides: Partial<MoodContext> = {}): MoodContext {
  return {
    state: "thinking",
    category: null,
    activeToolCallStartedAt: null,
    consecutiveErrors: 0,
    nowIso: NOW,
    ...overrides
  };
}

describe("deriveMood", () => {
  it("needs_permission and needs_input -> worried", () => {
    expect(deriveMood(ctx({ state: "needs_permission" }))).toBe("worried");
    expect(deriveMood(ctx({ state: "needs_input" }))).toBe("worried");
  });

  it("error with fewer than the frustration threshold -> dizzy", () => {
    expect(deriveMood(ctx({ state: "error", consecutiveErrors: FRUSTRATED_AFTER_ERRORS - 1 }))).toBe("dizzy");
    expect(deriveMood(ctx({ state: "error", consecutiveErrors: 0 }))).toBe("dizzy");
  });

  it("error at or above the frustration threshold -> frustrated", () => {
    expect(deriveMood(ctx({ state: "error", consecutiveErrors: FRUSTRATED_AFTER_ERRORS }))).toBe("frustrated");
    expect(deriveMood(ctx({ state: "error", consecutiveErrors: FRUSTRATED_AFTER_ERRORS + 5 }))).toBe("frustrated");
  });

  it("done -> proud", () => {
    expect(deriveMood(ctx({ state: "done" }))).toBe("proud");
  });

  it("thinking -> focused (never sleepy — this is the Part 1 fix)", () => {
    expect(deriveMood(ctx({ state: "thinking" }))).toBe("focused");
  });

  it("stalled -> concentrating, deliberately not sleepy (no Zzz for a subtle warning)", () => {
    expect(deriveMood(ctx({ state: "stalled" }))).toBe("concentrating");
  });

  it("sleeping -> sleepy (now only reachable after real awaiting_prompt timeout)", () => {
    expect(deriveMood(ctx({ state: "sleeping" }))).toBe("sleepy");
  });

  it("supervising -> concentrating", () => {
    expect(deriveMood(ctx({ state: "supervising" }))).toBe("concentrating");
  });

  it("awaiting_prompt -> focused", () => {
    expect(deriveMood(ctx({ state: "awaiting_prompt" }))).toBe("focused");
  });

  it("working on a delegate tool call -> excited, regardless of duration", () => {
    expect(deriveMood(ctx({ state: "working", category: "delegate" }))).toBe("excited");
    expect(
      deriveMood(ctx({ state: "working", category: "delegate", activeToolCallStartedAt: "2026-01-01T00:00:00.000Z" }), 5_000)
    ).toBe("excited");
  });

  it("working, short-running tool call -> focused", () => {
    const startedAt = "2026-01-01T00:00:55.000Z"; // 5s before NOW
    expect(deriveMood(ctx({ state: "working", category: "shell", activeToolCallStartedAt: startedAt }), 15_000)).toBe("focused");
  });

  it("working, tool call running longer than the threshold -> concentrating", () => {
    const startedAt = "2026-01-01T00:00:40.000Z"; // 20s before NOW
    expect(deriveMood(ctx({ state: "working", category: "shell", activeToolCallStartedAt: startedAt }), 15_000)).toBe(
      "concentrating"
    );
  });

  it("working with no active tool call timestamp -> focused (never crashes on missing data)", () => {
    expect(deriveMood(ctx({ state: "working", category: "read", activeToolCallStartedAt: null }))).toBe("focused");
  });

  it("the long-tool-call threshold is configurable", () => {
    const startedAt = "2026-01-01T00:00:50.000Z"; // 10s before NOW
    expect(deriveMood(ctx({ state: "working", category: "shell", activeToolCallStartedAt: startedAt }), 15_000)).toBe("focused");
    expect(deriveMood(ctx({ state: "working", category: "shell", activeToolCallStartedAt: startedAt }), 5_000)).toBe(
      "concentrating"
    );
  });
});
