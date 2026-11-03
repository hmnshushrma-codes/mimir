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
      if (ctx.category === "read") {
        return {
          ...base,
          pose: "sitting",
          activityLoop: "reading",
          expression: "curious",
          eyesClosed: false,
          gesture: null,
          props: props({ showBook: true, monitorContent: "off" }),
          effects: [],
          speechBubble: null
        };
      }
      if (ctx.category === "web") {
        return {
          ...base,
          pose: "sitting",
          activityLoop: "listening",
          expression: "curious",
          eyesClosed: false,
          gesture: null,
          props: props({ monitorContent: "dim" }),
          effects: [],
          speechBubble: null
        };
      }
      // write / shell / delegate / mcp / other — the "at the keyboard" bucket.
      const effects: EffectName[] = ctx.longRunning ? ["sweat"] : [];
      return {
        ...base,
        pose: "sitting",
        activityLoop: "typing",
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ showKeyboard: true, keyboardActive: true, monitorContent: "code" }),
        effects,
        speechBubble: null
      };
    }

    case "thinking":
      return {
        ...base,
        pose: "sitting",
        activityLoop: "thinking",
        expression: "curious",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "dim" }),
        effects: ["thought-bubble"],
        speechBubble: null
      };

    case "supervising":
      return {
        ...base,
        pose: "sitting",
        activityLoop: "supervising",
        expression: "focused",
        eyesClosed: false,
        gesture: null,
        props: props({ monitorContent: "code" }),
        effects: [],
        speechBubble: null
      };

    case "needs_permission":
      return {
        ...base,
        pose: "standing",
        activityLoop: null,
        expression: "pleading",
        eyesClosed: false,
        gesture: { name: "wave", playing: true },
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

    case "error": {
      const frustrated = ctx.consecutiveErrors >= 3;
      return {
        ...base,
        pose: "sitting",
        activityLoop: null,
        expression: frustrated ? "frustrated" : "confused",
        eyesClosed: false,
        gesture: { name: frustrated ? "facepalm" : "scratch-head", playing: true },
        props: props({ monitorContent: "off" }),
        effects: [frustrated ? "steam" : "dizzy-stars"],
        speechBubble: null
      };
    }

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
      // The foreman never visually sleeps — a long-idle foreman keeps the
      // same "idle holding phone" look as awaiting_prompt rather than
      // dozing off, since it's still the active supervisor of the session.
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
      // The ONLY state with eyesClosed — see docs/agent-states.md & Face
      // comment: done/sleeping must never be confusable with each other.
      return {
        ...base,
        pose: "leaning-back",
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
