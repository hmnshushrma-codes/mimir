import { useEffect, useRef, useState } from "react";
import { behaviourFor } from "./behaviourFor.js";
import type { Behaviour, BehaviourContext } from "./types.js";

export const STABLE_BEHAVIOUR_DWELL_MS = 200;

/** Never delay something urgent — these commit the instant they arrive. */
const URGENT_STATES: ReadonlySet<BehaviourContext["state"]> = new Set(["needs_permission", "needs_input", "error"]);

function sameContext(a: BehaviourContext, b: BehaviourContext): boolean {
  return (
    a.state === b.state &&
    a.category === b.category &&
    a.consecutiveErrors === b.consecutiveErrors &&
    a.isForeman === b.isForeman &&
    a.needsInputOptionCount === b.needsInputOptionCount &&
    a.donePhase === b.donePhase &&
    a.longRunning === b.longRunning &&
    a.teamColor === b.teamColor &&
    a.capColor === b.capColor
  );
}

/**
 * Debounces BehaviourContext changes before committing a new one, so a burst
 * of tool-call events (each producing a slightly different context) doesn't
 * flicker the character's face/gesture on every event. Framework-agnostic —
 * no React involved — so it's unit-testable with fake timers; the hook below
 * is a thin wrapper around it. See useStableBehaviour.test.ts.
 */
export class BehaviourDebouncer {
  private committed: BehaviourContext;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial: BehaviourContext, private readonly onCommit: (ctx: BehaviourContext) => void) {
    this.committed = initial;
  }

  get current(): BehaviourContext {
    return this.committed;
  }

  /** Call whenever the caller's live context changes. */
  update(ctx: BehaviourContext, dwellMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (sameContext(this.committed, ctx)) return;

    if (URGENT_STATES.has(ctx.state)) {
      this.committed = ctx;
      this.onCommit(ctx);
      return;
    }

    this.timer = setTimeout(() => {
      this.committed = ctx;
      this.timer = null;
      this.onCommit(ctx);
    }, dwellMs);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/**
 * Debounced behaviourFor() — the only way a live component should turn a
 * BehaviourContext into a Behaviour. See BehaviourDebouncer above for the
 * actual dwell logic.
 */
export function useStableBehaviour(ctx: BehaviourContext, dwellMs: number = STABLE_BEHAVIOUR_DWELL_MS): Behaviour {
  const [committed, setCommitted] = useState(ctx);
  const debouncerRef = useRef<BehaviourDebouncer | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = new BehaviourDebouncer(ctx, setCommitted);
  }

  useEffect(() => {
    debouncerRef.current!.update(ctx, dwellMs);
  }, [ctx, dwellMs]);

  useEffect(() => () => debouncerRef.current?.dispose(), []);

  return behaviourFor(committed);
}
