import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviourDebouncer, STABLE_BEHAVIOUR_DWELL_MS } from "./useStableBehaviour.js";
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("BehaviourDebouncer", () => {
  it("does not commit a change before the dwell window elapses", () => {
    const onCommit = vi.fn();
    const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

    debouncer.update(ctx({ state: "working" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS - 1);

    expect(onCommit).not.toHaveBeenCalled();
    expect(debouncer.current.state).toBe("thinking");
  });

  it("commits once the dwell window fully elapses", () => {
    const onCommit = vi.fn();
    const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

    debouncer.update(ctx({ state: "working" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(debouncer.current.state).toBe("working");
  });

  it("a burst of rapid changes within the dwell window commits only the last one, once", () => {
    const onCommit = vi.fn();
    const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

    debouncer.update(ctx({ state: "working", category: "read" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(50);
    debouncer.update(ctx({ state: "working", category: "write" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(50);
    debouncer.update(ctx({ state: "working", category: "shell" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(debouncer.current.category).toBe("shell");
  });

  it("returning to the already-committed context before the dwell fires cancels the pending commit", () => {
    const onCommit = vi.fn();
    const original = ctx({ state: "thinking" });
    const debouncer = new BehaviourDebouncer(original, onCommit);

    debouncer.update(ctx({ state: "working" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(50);
    debouncer.update(original, STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS + 50);

    expect(onCommit).not.toHaveBeenCalled();
    expect(debouncer.current.state).toBe("thinking");
  });

  it.each(["needs_permission", "needs_input", "error"] as const)(
    "commits %s immediately, bypassing the dwell window",
    (urgentState) => {
      const onCommit = vi.fn();
      const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

      debouncer.update(ctx({ state: urgentState }), STABLE_BEHAVIOUR_DWELL_MS);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(debouncer.current.state).toBe(urgentState);
    }
  );

  it("an urgent change cancels a previously pending non-urgent commit", () => {
    const onCommit = vi.fn();
    const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

    debouncer.update(ctx({ state: "working" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(50);
    debouncer.update(ctx({ state: "needs_permission" }), STABLE_BEHAVIOUR_DWELL_MS);
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS + 50);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(debouncer.current.state).toBe("needs_permission");
  });

  it("dispose() clears any pending timer", () => {
    const onCommit = vi.fn();
    const debouncer = new BehaviourDebouncer(ctx({ state: "thinking" }), onCommit);

    debouncer.update(ctx({ state: "working" }), STABLE_BEHAVIOUR_DWELL_MS);
    debouncer.dispose();
    vi.advanceTimersByTime(STABLE_BEHAVIOUR_DWELL_MS + 50);

    expect(onCommit).not.toHaveBeenCalled();
  });
});
