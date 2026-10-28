import type { Mood } from "@agent-workshop/shared";

/**
 * Single source of truth for how every character looks in every state.
 * The renderer reads ONLY this config — no scattered if/else.
 */

export type CharacterState =
  | "idle"        // Foreman: relaxed, phone in hand
  | "thinking"    // Foreman: generating, hand on chin
  | "working"     // Both: typing on keyboard
  | "waiting"     // Both: waiting for permission/input
  | "error"       // Both: tool failed
  | "done"        // Both: brief happy reaction (2-3s)
  | "sleeping"    // Agent: finished, head down, Zzz
  | "spawned"     // Agent: just appeared, looking around
  | "leaving";    // Agent: waking up, fading out

export type EyeState = "open" | "focused" | "half" | "closed" | "wide" | "squint";
export type HeadPose = "still" | "tilt" | "at-monitor" | "at-viewer" | "down";
export type HandState = "typing" | "holding-phone" | "resting" | "waving" | "on-head" | "on-chin" | "hidden";
export type MonitorState = "off" | "dim" | "code-scrolling" | "cursor-blinking" | "error-text";

export interface CharacterProfile {
  eyes: EyeState;
  headPose: HeadPose;
  leftHand: HandState;
  rightHand: HandState;
  showPhone: boolean;       // Phone visible at all
  phonePosition: "in-hand" | "on-desk" | "hidden";
  showMug: boolean;
  monitorState: MonitorState;
  showZzz: boolean;         // ONLY true for sleeping
  showErrorBadge: boolean;
  showThinkingDots: boolean;
  showTypingHands: boolean;
  lampDim: boolean;          // true = agent dims their lamp (world day/night still applies)
  transitionMs: number;
}

// ─── Foreman profiles ──────────────────────────────────────

const FOREMAN_IDLE: CharacterProfile = {
  eyes: "half",
  headPose: "tilt",
  leftHand: "holding-phone",
  rightHand: "resting",
  showPhone: true,
  phonePosition: "in-hand",
  showMug: true,
  monitorState: "dim",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 400,
};

const FOREMAN_THINKING: CharacterProfile = {
  eyes: "focused",
  headPose: "still",
  leftHand: "on-chin",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: true,
  monitorState: "cursor-blinking",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: true,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 300,
};

const FOREMAN_WORKING: CharacterProfile = {
  eyes: "focused",
  headPose: "at-monitor",
  leftHand: "typing",
  rightHand: "typing",
  showPhone: false,
  phonePosition: "hidden",
  showMug: true,
  monitorState: "code-scrolling",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: true,
  lampDim: false,
  transitionMs: 300,
};

const FOREMAN_WAITING: CharacterProfile = {
  eyes: "wide",
  headPose: "at-viewer",
  leftHand: "resting",
  rightHand: "waving",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "dim",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 300,
};

const FOREMAN_ERROR: CharacterProfile = {
  eyes: "squint",
  headPose: "still",
  leftHand: "on-head",
  rightHand: "on-head",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "error-text",
  showZzz: false,
  showErrorBadge: true,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 200,
};

const FOREMAN_DONE: CharacterProfile = {
  eyes: "open",
  headPose: "at-viewer",
  leftHand: "resting",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: true,
  monitorState: "dim",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 300,
};

// ─── Agent profiles ────────────────────────────────────────

const AGENT_SPAWNED: CharacterProfile = {
  eyes: "open",
  headPose: "still",
  leftHand: "resting",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "dim",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 400,
};

const AGENT_WORKING: CharacterProfile = {
  eyes: "focused",
  headPose: "at-monitor",
  leftHand: "typing",
  rightHand: "typing",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "code-scrolling",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: true,
  lampDim: false,
  transitionMs: 300,
};

const AGENT_WAITING: CharacterProfile = {
  eyes: "open",
  headPose: "still",
  leftHand: "resting",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "dim",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 300,
};

const AGENT_SLEEPING: CharacterProfile = {
  eyes: "closed",
  headPose: "down",
  leftHand: "resting",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "off",
  showZzz: true,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: true,
  transitionMs: 400,
};

const AGENT_ERROR: CharacterProfile = {
  eyes: "squint",
  headPose: "still",
  leftHand: "on-head",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "error-text",
  showZzz: false,
  showErrorBadge: true,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: false,
  transitionMs: 200,
};

const AGENT_LEAVING: CharacterProfile = {
  eyes: "half",
  headPose: "still",
  leftHand: "resting",
  rightHand: "resting",
  showPhone: false,
  phonePosition: "hidden",
  showMug: false,
  monitorState: "off",
  showZzz: false,
  showErrorBadge: false,
  showThinkingDots: false,
  showTypingHands: false,
  lampDim: true,
  transitionMs: 300,
};

// ─── Profile lookup tables ─────────────────────────────────

const FOREMAN_PROFILES: Record<CharacterState, CharacterProfile> = {
  idle: FOREMAN_IDLE,
  thinking: FOREMAN_THINKING,
  working: FOREMAN_WORKING,
  waiting: FOREMAN_WAITING,
  error: FOREMAN_ERROR,
  done: FOREMAN_DONE,
  sleeping: FOREMAN_IDLE,   // Foreman never truly sleeps, falls back to idle
  spawned: FOREMAN_IDLE,
  leaving: FOREMAN_IDLE,
};

const AGENT_PROFILES: Record<CharacterState, CharacterProfile> = {
  idle: AGENT_WAITING,
  thinking: AGENT_WORKING,
  working: AGENT_WORKING,
  waiting: AGENT_WAITING,
  error: AGENT_ERROR,
  done: AGENT_SLEEPING,
  sleeping: AGENT_SLEEPING,
  spawned: AGENT_SPAWNED,
  leaving: AGENT_LEAVING,
};

export function getProfile(role: "foreman" | "agent", state: CharacterState): CharacterProfile {
  return role === "foreman" ? FOREMAN_PROFILES[state] : AGENT_PROFILES[state];
}

/**
 * Maps the existing mood (from the shared state machine) to a CharacterState.
 * This is the ONLY place that translates mood → visual state.
 */
export function moodToState(mood: Mood, isForeman: boolean, hasActiveTool: boolean): CharacterState {
  switch (mood) {
    case "worried":
      return "waiting";
    case "dizzy":
    case "frustrated":
      return "error";
    case "proud":
      return isForeman ? "done" : "sleeping";
    case "sleepy":
      return isForeman ? "idle" : "sleeping";
    case "excited":
      return "working";
    case "concentrating":
      return isForeman ? (hasActiveTool ? "working" : "thinking") : "working";
    case "focused":
      return isForeman ? (hasActiveTool ? "working" : "thinking") : "working";
    case "neutral":
      return isForeman ? "idle" : "spawned";
    default:
      return isForeman ? "idle" : "spawned";
  }
}

/** Sleep hold duration before agent removal (seconds). */
export const SLEEP_HOLD_SECONDS = 8;
