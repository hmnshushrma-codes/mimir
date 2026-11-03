import type { ActionCategory, DisplayState } from "@agent-workshop/shared";

// ─── Layer unions (Part 2/3 spec) ───────────────────────────────

export type Pose = "sitting" | "standing" | "leaning-back" | "jumping";

export type ActivityLoop = "typing" | "reading" | "listening" | "thinking" | "supervising" | null;

export type Expression =
  | "focused"
  | "happy"
  | "curious"
  | "worried"
  | "pleading"
  | "confused"
  | "frustrated"
  | "proud"
  | "sleepy"
  | "surprised";

export type GestureName =
  | "wave"
  | "raise-hand"
  | "nod-yes"
  | "shake-no"
  | "shrug"
  | "thumbs-up"
  | "scratch-head"
  | "facepalm"
  | "stretch"
  | "sip-tea"
  | "drum-fingers"
  | "point"
  | "clap";

export type EffectName =
  | "zzz"
  | "sweat"
  | "thought-bubble"
  | "speech-bubble"
  | "steam"
  | "dizzy-stars"
  | "sparkles"
  | "lightbulb";

export interface PropsConfig {
  showMonitor: boolean;
  /** "awaiting-prompt" is the foreman-only ">_" cursor look — distinct from
   *  plain "dim" idle, since DisplayState now makes that distinction cheap
   *  to own here instead of a component peeking at raw state. */
  monitorContent: "off" | "code" | "book-page" | "done-check" | "dim" | "awaiting-prompt";
  showKeyboard: boolean;
  keyboardActive: boolean;
  showMug: boolean;
  showBook: boolean;
  showRadio: boolean;
  signs: { yes: boolean; no: boolean } | null;
  /** Foreman-only, "idle holding phone" look (awaiting_prompt / sleeping). */
  showPhone: boolean;
  phonePosition: "in-hand" | "on-desk" | "hidden";
  /** True = this agent dims their own lamp (world day/night still applies on
   *  top — see ForemanDesk/WorkerDesk's lampOn derivation). Only true for a
   *  resting subagent (sleeping); never for the foreman. */
  lampDim: boolean;
}

export interface GestureState {
  name: GestureName;
  /** True while the one-off clip is actively playing on top of the loop. */
  playing: boolean;
}

export interface SpeechBubbleContent {
  text: "?";
  optionCount: number;
}

/**
 * The single object RiggedCharacter consumes — pose + activity loop + face
 * expression + gestures + props + effects, exactly as Part 3 specifies.
 * Nothing in the rig reads state/mood directly; everything comes from here.
 */
export interface Behaviour {
  pose: Pose;
  activityLoop: ActivityLoop;
  expression: Expression;
  /** Eyes closed is reserved for "sleeping" — see docs note in behaviourFor.ts. */
  eyesClosed: boolean;
  gesture: GestureState | null;
  props: PropsConfig;
  effects: EffectName[];
  speechBubble: SpeechBubbleContent | null;
  teamColor: string;
  capColor: string;
  isForeman: boolean;
}

/** Context behaviourFor() derives a Behaviour from. Mirrors
 *  DisplayStateContext (packages/shared/src/display-state.ts) plus two
 *  Part-2-only extras the spec needs that the state model doesn't carry. */
export interface BehaviourContext {
  state: DisplayState;
  category: ActionCategory | null;
  consecutiveErrors: number;
  isForeman: boolean;
  /** Only meaningful for needs_input. */
  needsInputOptionCount: number;
  /** Only meaningful for "done" — which of the two phases to render. Who
   *  owns the phase clock (a timer) is decided when this is wired to real
   *  elapsed time in Part 2b; the Lab sets it manually. */
  donePhase: 1 | 2;
  /** True while an open tool call has run long enough to warrant "sweat". */
  longRunning: boolean;
  teamColor: string;
  capColor: string;
}
