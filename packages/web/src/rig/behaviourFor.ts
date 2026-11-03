import type { Behaviour, BehaviourContext, EffectName, PropsConfig } from "./types.js";

const NO_PROPS: PropsConfig = {
  showMonitor: true,
  monitorContent: "off",
  showKeyboard: false,
  keyboardActive: false,
  showMug: false,
  showBook: false,
  showRadio: false,
  signs: null,
  showPhone: false,
  phonePosition: "hidden",
  lampDim: false
};

function props(overrides: Partial<PropsConfig>): PropsConfig {
  return { ...NO_PROPS, ...overrides };
}

/**
 * Pure state -> behaviour mapping (docs: Part 2a plan, "behaviourFor" table).
 * Every visual layer (pose, loop, face, gesture, props, effects) comes from
 * here — RiggedCharacter never branches on displayState itself.
 *
 * Two deliberate omissions, left to the caller/Part 2b:
 *  - needs_permission's 30s/2min jump escalation needs real elapsed time,
 *    which this pure function doesn't have (and shouldn't — see docs). It
 *    always returns the baseline "standing" pose; escalating to "jumping"
 *    is the renderer's job once wired to live timestamps.
 *  - The one-off "answered" transition gesture (nod-yes/shrug) depends on
 *    what the PREVIOUS state was, not just the current one, so it isn't a
 *    pure function of BehaviourContext either. Part 2b plays it explicitly
 *    on the state-change edge; the Lab triggers gestures manually via Play.
 */
export function behaviourFor(ctx: BehaviourContext): Behaviour {
  const base = {
    teamColor: ctx.teamColor,
    capColor: ctx.capColor,
    isForeman: ctx.isForeman
  };

  switch (ctx.state) {
    case "working": {
      // Spec 5.4: work_read — eyes scan left-right, head nods, reading loop
      if (ctx.category === "read") {
        return {
          ...base,
          pose: "sitting",
          activityLoop: "reading",
          expression: "focused",
          eyesClosed: false,
          gesture: null,
          props: props({ showBook: true, monitorContent: "code" }),
          effects: [],
          speechBubble: null
        };
      }
      // Spec 5.6: work_run — half-lidded focus, waiting rhythm
      if (ctx.category === "web" || ctx.category === "shell") {
        return {
          ...base,
          pose: "sitting",
          activityLoop: "listening",
          expression: "focused",
          eyesClosed: false,
          gesture: null,
          props: props({ monitorContent: "code" }),
          effects: ctx.longRunning ? ["sweat"] : [],
          speechBubble: null
        };
      }
      // Spec 5.5: work_type — leaned in 3deg, typing, sweat after longRunning
      const effects: EffectName[] = ctx.longRunning ? ["sweat"] : [];
      return {
        ...base,
        pose: "leaning-forward",
        activityLoop: "typing",
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ showKeyboard: true, keyboardActive: true, monitorContent: "code" }),
        effects,
        speechBubble: null
      };
    }

    // Spec 5.3: think — eyes drift up, one brow up, hand to chin briefly
    case "thinking":
      return {
        ...base,
        pose: "sitting",
        activityLoop: "thinking",
        expression: "curious",
        eyesClosed: false,
        gesture: { name: "sip-tea", playing: true },
        props: props({ monitorContent: "dim" }),
        effects: ["thought-bubble"],
        speechBubble: null
      };

    // Spec 6: supervise — slightly upright, eyes alternate between helpers
    case "supervising":
      return {
        ...base,
        pose: "sitting",
        activityLoop: "supervising",
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "code", showMug: true }),
        effects: [],
        speechBubble: null
      };

    // Spec 7: raise hand — polite, hard to miss, not panicky.
    // Brow slightly raised (asking, not demanding). Small sweat only.
    case "needs_permission":
      return {
        ...base,
        pose: "standing",
        activityLoop: null,
        expression: "pleading",
        eyesClosed: false,
        gesture: { name: "raise-hand", playing: true },
        props: props({ signs: { yes: true, no: true }, monitorContent: "dim" }),
        effects: ["sweat"],
        speechBubble: null
      };

    case "needs_input":
      return {
        ...base,
        pose: "standing",
        activityLoop: null,
        expression: "curious",
        eyesClosed: false,
        gesture: { name: "raise-hand", playing: true },
        props: props({ monitorContent: "dim" }),
        effects: ["sweat"],
        speechBubble: { text: "?", optionCount: ctx.needsInputOptionCount }
      };

    // Spec 5.8/5.9/12.7: oops then retry. After 3 failures, calm "regroup"
    // (deep breath, hands on laptop) — never looks more panicked over time.
    case "error": {
      const regroup = ctx.consecutiveErrors >= 3;
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: regroup ? "frustrated" : "worried",
        eyesClosed: false,
        gesture: { name: regroup ? "shrug" : "scratch-head", playing: true },
        props: props({ monitorContent: "off" }),
        effects: regroup ? [] : ["sweat"],
        speechBubble: null
      };
    }

    // Spec 5.11: celebrate — pop, cheer/thumbs-up, sparkles, then settle
    case "done": {
      if (ctx.donePhase === 1) {
        return {
          ...base,
          pose: "standing",
          activityLoop: null,
          expression: "proud",
          eyesClosed: false,
          gesture: { name: "thumbs-up", playing: true },
          props: props({ monitorContent: "done-check" }),
          effects: ["sparkles"],
          speechBubble: null
        };
      }
      // Settle: back to relaxed with follow-through
      return {
        ...base,
        pose: "leaning-back",
        activityLoop: null,
        expression: "happy",
        eyesClosed: false,
        gesture: null,
        props: props({ showMug: true, monitorContent: "dim" }),
        effects: [],
        speechBubble: null
      };
    }

    case "awaiting_prompt":
      // Foreman "idle holding phone" look — ported from the old profile
      // system's FOREMAN_IDLE. Subagents don't carry a phone.
      if (ctx.isForeman) {
        return {
          ...base,
          pose: "leaning-back",
          activityLoop: null,
          expression: "happy",
          eyesClosed: false,
          gesture: null,
          props: props({ monitorContent: "awaiting-prompt", showMug: true, showPhone: true, phonePosition: "in-hand" }),
          effects: [],
          speechBubble: null
        };
      }
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "dim" }),
        effects: [],
        speechBubble: null
      };

    case "sleeping":
      // Eyes closed, sitting still, Zzz. Same for foreman and subagents.
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: "sleepy",
        eyesClosed: true,
        gesture: null,
        props: props({ monitorContent: "off", lampDim: true }),
        effects: ["zzz"],
        speechBubble: null
      };

    case "stalled":
      // Deliberately NO effect here — "sweat" is only allowlisted for
      // working-long-call / needs_*, not stalled (see Effects.tsx). A
      // "subtle warning" shows via expression alone, not an icon.
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: "curious",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "dim" }),
        effects: [],
        speechBubble: null
      };

    default:
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "off" }),
        effects: [],
        speechBubble: null
      };
  }
}
