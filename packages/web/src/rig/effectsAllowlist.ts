import type { BehaviourContext, EffectName } from "./types.js";

/**
 * The gating rule for every effect, from the Part 2a spec:
 *   Zzz            -> sleeping only
 *   Dizzy stars    -> error only (and specifically the <3-consecutive case)
 *   Sweat          -> working on a long call, or needs_permission/needs_input
 *   Thought bubble -> thinking only
 *   Sparkles       -> done, phase 1 only
 *   Speech bubble  -> needs_input only
 *   Steam          -> error, 3+ consecutive failures only
 *
 * This is the enforcement point, not just documentation: Effects.tsx calls
 * `isEffectAllowed` before rendering anything, so a future bad call site
 * (e.g. behaviourFor returning the wrong effect for a state) still can't
 * put Zzz on an awake character — it fails closed, not open.
 */
export function isEffectAllowed(effect: EffectName, ctx: BehaviourContext): boolean {
  switch (effect) {
    case "zzz":
      return ctx.state === "sleeping";
    case "dizzy-stars":
      return ctx.state === "error" && ctx.consecutiveErrors < 3;
    case "sweat":
      return (ctx.state === "working" && ctx.longRunning) || ctx.state === "needs_permission" || ctx.state === "needs_input";
    case "thought-bubble":
      return ctx.state === "thinking";
    case "sparkles":
      return ctx.state === "done" && ctx.donePhase === 1;
    case "speech-bubble":
      return ctx.state === "needs_input";
    case "steam":
      return ctx.state === "error" && ctx.consecutiveErrors >= 3;
    case "lightbulb":
      // Not yet mapped to any state by behaviourFor — reserved, allow none
      // until a real use is designed (fails closed, matching every other
      // effect here, rather than defaulting to "always visible").
      return false;
    default:
      return false;
  }
}

/** Filters a requested effect list down to only what's actually allowed —
 *  the defensive filter Effects.tsx applies before rendering anything. */
export function filterAllowedEffects(effects: EffectName[], ctx: BehaviourContext): EffectName[] {
  return effects.filter((e) => isEffectAllowed(e, ctx));
}
