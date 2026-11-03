import { describe, expect, it } from "vitest";
import { DISPLAY_STATES } from "@agent-workshop/shared";
import { filterAllowedEffects, isEffectAllowed } from "./effectsAllowlist.js";
import type { BehaviourContext, EffectName } from "./types.js";

function ctx(overrides: Partial<BehaviourContext> = {}): BehaviourContext {
  return {
    state: "thinking",
    category: null,
    consecutiveErrors: 0,
    isForeman: false,
    needsInputOptionCount: 0,
    donePhase: 1,
    longRunning: false,
    teamColor: "#2a78d6",
    capColor: "#1b1d23",
    ...overrides
  };
}

const ALL_EFFECTS: EffectName[] = [
  "zzz",
  "sweat",
  "thought-bubble",
  "speech-bubble",
  "steam",
  "dizzy-stars",
  "sparkles",
  "lightbulb"
];

describe("isEffectAllowed — one gating rule per effect, checked across every state", () => {
  it("zzz is allowed in sleeping and ONLY sleeping", () => {
    for (const state of DISPLAY_STATES) {
      expect(isEffectAllowed("zzz", ctx({ state }))).toBe(state === "sleeping");
    }
  });

  it("dizzy-stars is allowed only for error with <3 consecutive failures", () => {
    expect(isEffectAllowed("dizzy-stars", ctx({ state: "error", consecutiveErrors: 1 }))).toBe(true);
    expect(isEffectAllowed("dizzy-stars", ctx({ state: "error", consecutiveErrors: 3 }))).toBe(false);
    for (const state of DISPLAY_STATES) {
      if (state === "error") continue;
      expect(isEffectAllowed("dizzy-stars", ctx({ state }))).toBe(false);
    }
  });

  it("sweat is allowed only for a long-running working call, needs_permission, or needs_input", () => {
    expect(isEffectAllowed("sweat", ctx({ state: "working", longRunning: true }))).toBe(true);
    expect(isEffectAllowed("sweat", ctx({ state: "working", longRunning: false }))).toBe(false);
    expect(isEffectAllowed("sweat", ctx({ state: "needs_permission" }))).toBe(true);
    expect(isEffectAllowed("sweat", ctx({ state: "needs_input" }))).toBe(true);
    expect(isEffectAllowed("sweat", ctx({ state: "stalled" }))).toBe(false);
    expect(isEffectAllowed("sweat", ctx({ state: "thinking" }))).toBe(false);
  });

  it("thought-bubble is allowed only for thinking", () => {
    for (const state of DISPLAY_STATES) {
      expect(isEffectAllowed("thought-bubble", ctx({ state }))).toBe(state === "thinking");
    }
  });

  it("sparkles is allowed only for done phase 1", () => {
    expect(isEffectAllowed("sparkles", ctx({ state: "done", donePhase: 1 }))).toBe(true);
    expect(isEffectAllowed("sparkles", ctx({ state: "done", donePhase: 2 }))).toBe(false);
    for (const state of DISPLAY_STATES) {
      if (state === "done") continue;
      expect(isEffectAllowed("sparkles", ctx({ state, donePhase: 1 }))).toBe(false);
    }
  });

  it("speech-bubble is allowed only for needs_input", () => {
    for (const state of DISPLAY_STATES) {
      expect(isEffectAllowed("speech-bubble", ctx({ state }))).toBe(state === "needs_input");
    }
  });

  it("steam is allowed only for error with 3+ consecutive failures", () => {
    expect(isEffectAllowed("steam", ctx({ state: "error", consecutiveErrors: 3 }))).toBe(true);
    expect(isEffectAllowed("steam", ctx({ state: "error", consecutiveErrors: 2 }))).toBe(false);
    for (const state of DISPLAY_STATES) {
      if (state === "error") continue;
      expect(isEffectAllowed("steam", ctx({ state, consecutiveErrors: 5 }))).toBe(false);
    }
  });

  it("lightbulb is reserved — not allowed anywhere yet", () => {
    for (const state of DISPLAY_STATES) {
      expect(isEffectAllowed("lightbulb", ctx({ state }))).toBe(false);
    }
  });
});

describe("filterAllowedEffects", () => {
  it("strips a disallowed effect rather than rendering it", () => {
    const filtered = filterAllowedEffects(["zzz", "thought-bubble"], ctx({ state: "thinking" }));
    expect(filtered).toEqual(["thought-bubble"]);
  });

  it("every effect from every real behaviourFor() output passes its own allowlist", async () => {
    const { behaviourFor } = await import("./behaviourFor.js");
    for (const state of DISPLAY_STATES) {
      for (const donePhase of [1, 2] as const) {
        for (const consecutiveErrors of [0, 1, 3]) {
          const context = ctx({ state, donePhase, consecutiveErrors, longRunning: true });
          const behaviour = behaviourFor(context);
          for (const effect of behaviour.effects) {
            expect(isEffectAllowed(effect, context)).toBe(true);
          }
        }
      }
    }
  });
});
