import { describe, expect, it } from "vitest";
import { DISPLAY_STATES, type DisplayState } from "@agent-workshop/shared";
import { behaviourFor } from "./behaviourFor.js";
import type { BehaviourContext } from "./types.js";

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

describe("behaviourFor — one case per table row", () => {
  it("working, write/shell category -> leaning-forward + typing + focused", () => {
    const b = behaviourFor(ctx({ state: "working", category: "write" }));
    expect(b.pose).toBe("leaning-forward");
    expect(b.activityLoop).toBe("typing");
    expect(b.expression).toBe("focused");
    expect(b.props.showKeyboard).toBe(true);
  });

  it("working, write/shell + long-running -> sweat", () => {
    const b = behaviourFor(ctx({ state: "working", category: "write", longRunning: true }));
    expect(b.effects).toContain("sweat");
  });

  it("working, read category -> sitting + reading + focused", () => {
    const b = behaviourFor(ctx({ state: "working", category: "read" }));
    expect(b.activityLoop).toBe("reading");
    expect(b.expression).toBe("focused");
    expect(b.props.showBook).toBe(true);
  });

  it("working, web/shell category -> listening + focused", () => {
    const b = behaviourFor(ctx({ state: "working", category: "web" }));
    expect(b.activityLoop).toBe("listening");
    expect(b.expression).toBe("focused");
  });

  it("thinking -> sitting + thinking loop + curious + thought bubble", () => {
    const b = behaviourFor(ctx({ state: "thinking" }));
    expect(b.pose).toBe("sitting");
    expect(b.activityLoop).toBe("thinking");
    expect(b.expression).toBe("curious");
    expect(b.effects).toEqual(["thought-bubble"]);
  });

  it("supervising -> sitting + supervising loop + focused", () => {
    const b = behaviourFor(ctx({ state: "supervising", isForeman: true }));
    expect(b.activityLoop).toBe("supervising");
    expect(b.expression).toBe("focused");
  });

  it("needs_permission -> standing + pleading + YES/NO signs + raise-hand", () => {
    const b = behaviourFor(ctx({ state: "needs_permission" }));
    expect(b.pose).toBe("standing");
    expect(b.expression).toBe("pleading");
    expect(b.props.signs).toEqual({ yes: true, no: true });
    expect(b.gesture?.name).toBe("raise-hand");
  });

  it("needs_input -> standing + curious + speech bubble with option count", () => {
    const b = behaviourFor(ctx({ state: "needs_input", needsInputOptionCount: 3 }));
    expect(b.pose).toBe("standing");
    expect(b.expression).toBe("curious");
    expect(b.speechBubble).toEqual({ text: "?", optionCount: 3 });
  });

  it("error, <3 consecutive -> worried + scratch-head + sweat", () => {
    const b = behaviourFor(ctx({ state: "error", consecutiveErrors: 1 }));
    expect(b.expression).toBe("worried");
    expect(b.gesture?.name).toBe("scratch-head");
    expect(b.effects).toEqual(["sweat"]);
  });

  it("error, 3+ consecutive -> frustrated + shrug + calm regroup (no effects)", () => {
    const b = behaviourFor(ctx({ state: "error", consecutiveErrors: 3 }));
    expect(b.expression).toBe("frustrated");
    expect(b.gesture?.name).toBe("shrug");
    expect(b.effects).toEqual([]);
  });

  it("done phase 1 -> standing + proud + thumbs-up + sparkles, eyes open", () => {
    const b = behaviourFor(ctx({ state: "done", donePhase: 1 }));
    expect(b.pose).toBe("standing");
    expect(b.expression).toBe("proud");
    expect(b.gesture?.name).toBe("thumbs-up");
    expect(b.effects).toEqual(["sparkles"]);
    expect(b.eyesClosed).toBe(false);
  });

  it("done phase 2 -> leaning back + happy + mug, eyes open, no Zzz", () => {
    const b = behaviourFor(ctx({ state: "done", donePhase: 2 }));
    expect(b.pose).toBe("leaning-back");
    expect(b.expression).toBe("happy");
    expect(b.props.showMug).toBe(true);
    expect(b.eyesClosed).toBe(false);
    expect(b.effects).not.toContain("zzz");
  });

  it("sleeping -> sitting + sleepy + Zzz, eyes CLOSED", () => {
    const b = behaviourFor(ctx({ state: "sleeping" }));
    expect(b.pose).toBe("sitting");
    expect(b.expression).toBe("sleepy");
    expect(b.eyesClosed).toBe(true);
    expect(b.effects).toEqual(["zzz"]);
    expect(b.props.lampDim).toBe(true);
  });

  it("foreman sleeps the same as subagents — eyes closed, zzz", () => {
    const sleeping = behaviourFor(ctx({ state: "sleeping", isForeman: true }));
    expect(sleeping.eyesClosed).toBe(true);
    expect(sleeping.effects).toContain("zzz");
    expect(sleeping.props.lampDim).toBe(true);
    expect(sleeping.expression).toBe("sleepy");
  });

  it("awaiting_prompt only shows the phone for the foreman, not subagents", () => {
    const foreman = behaviourFor(ctx({ state: "awaiting_prompt", isForeman: true }));
    const subagent = behaviourFor(ctx({ state: "awaiting_prompt", isForeman: false }));
    expect(foreman.props.showPhone).toBe(true);
    expect(subagent.props.showPhone).toBe(false);
  });

  it("stalled -> no effects (sweat is not allowlisted for stalled)", () => {
    const b = behaviourFor(ctx({ state: "stalled" }));
    expect(b.effects).toEqual([]);
  });
});

describe("behaviourFor — cross-cutting invariants", () => {
  it("eyesClosed is true for sleeping and only sleeping", () => {
    for (const state of DISPLAY_STATES) {
      const b = behaviourFor(ctx({ state, donePhase: 1 }));
      expect(b.eyesClosed).toBe(state === "sleeping");
    }
  });

  it("done and sleeping are never visually identical (pose or expression differs)", () => {
    const done2 = behaviourFor(ctx({ state: "done", donePhase: 2 }));
    const sleeping = behaviourFor(ctx({ state: "sleeping" }));
    expect(done2.eyesClosed).not.toBe(sleeping.eyesClosed);
    expect(done2.expression).not.toBe(sleeping.expression);
  });

  it("produces a valid Behaviour for every real display state", () => {
    const states: DisplayState[] = [...DISPLAY_STATES];
    for (const state of states) {
      const b = behaviourFor(ctx({ state }));
      expect(b.pose).toBeTruthy();
      expect(b.expression).toBeTruthy();
      expect(Array.isArray(b.effects)).toBe(true);
    }
  });
});
