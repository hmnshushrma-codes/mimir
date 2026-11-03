import type { BehaviourContext, EffectName } from "./types.js";

/**
 * The gating rule for every effect, aligned with the mascot expression spec:
 *   Zzz            -> sleeping only
 *   Sweat          -> working (long call), needs_permission/needs_input, or error (<3)
 *   Thought bubble -> thinking only
 *   Sparkles       -> done, phase 1 only
 *   Speech bubble  -> needs_input only
 *
 * This is the enforcement point, not just documentation: Effects.tsx calls
 * `isEffectAllowed` before rendering anything, so a future bad call site
 * can't put Zzz on an awake character — it fails closed, not open.
 */
export function isEffectAllowed(effect: EffectName, ctx: BehaviourContext): boolean {
  switch (effect) {
    case "zzz":
      return ctx.state === "sleeping";
    case "dizzy-stars":
      return ctx.state === "error" && ctx.consecutiveErrors < 3;
    case "sweat":
      // Spec: sweat for working-long, needs_*, and error (<3 consecutive).
      // After 3+ failures, calm regroup — no sweat (spec 12.7).
      return (ctx.state === "working" && ctx.longRunning)
        || ctx.state === "needs_permission"
        || ctx.state === "needs_input"
        || (ctx.state === "error" && ctx.consecutiveErrors < 3);
    case "thought-bubble":
      return ctx.state === "thinking";
    case "sparkles":
      return ctx.state === "done" && ctx.donePhase === 1;
    case "speech-bubble":
      return ctx.state === "needs_input";
    case "steam":
      return ctx.state === "error" && ctx.consecutiveErrors >= 3;
    case "lightbulb":
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
