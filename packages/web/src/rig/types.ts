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
  monitorContent: "off" | "code" | "book-page" | "done-check" | "dim";
  showKeyboard: boolean;
  keyboardActive: boolean;
  showMug: boolean;
  showBook: boolean;
  showRadio: boolean;
  signs: { yes: boolean; no: boolean } | null;
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
