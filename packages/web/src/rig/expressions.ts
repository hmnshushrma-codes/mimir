import type { Expression } from "./types.js";

export const EXPRESSIONS: Expression[] = [
  "focused",
  "happy",
  "curious",
  "worried",
  "pleading",
  "confused",
  "frustrated",
  "proud",
  "sleepy",
  "surprised"
];

export type MouthShape = "smile" | "grin" | "flat" | "o" | "wobbly" | "frown" | "open-talk" | "yawn";
export type EyeGaze = "viewer" | "monitor" | "up-side" | "down" | "side-to-side";
export type EyebrowPose = "neutral" | "raised" | "angled-in" | "angled-out" | "worried" | "lowered";

export interface ExpressionPreset {
  eyeGaze: EyeGaze;
  eyebrows: EyebrowPose;
  mouth: MouthShape;
  blush: boolean;
}

/**
 * Each expression's eyes/eyebrows/mouth/cheeks preset, aligned with the
 * mascot expression spec (section 8). Does NOT control whether the eyes are
 * open or closed — that's `Behaviour.eyesClosed`, reserved exclusively for
 * "sleeping" (see behaviourFor.ts).
 *
 * Design goals from the spec:
 * - Readable in under 300ms at a glance
 * - Calm by default — `focused` is the hour-long default, must be pleasant
 * - Big expressions are rare and meaningful
 * - Never angry — errors are "oops", not hostility
 */
export const EXPRESSION_PRESETS: Record<Expression, ExpressionPreset> = {
  // Spec: `focus` — lids slightly down, pupils on target, pressed mouth
  focused: { eyeGaze: "monitor", eyebrows: "neutral", mouth: "flat", blush: false },
  // Spec: `happy` — arc squint eyes, small smile
  happy: { eyeGaze: "viewer", eyebrows: "raised", mouth: "smile", blush: true },
  // Spec: `curious` — wide eyes, pupils drifting, one brow up, small "o"
  curious: { eyeGaze: "up-side", eyebrows: "raised", mouth: "o", blush: false },
  // Spec: `worried` — wide eyes, small pupils, brow up in middle, wobble mouth
  worried: { eyeGaze: "viewer", eyebrows: "worried", mouth: "wobbly", blush: false },
  // Spec: `asking` — wide eyes on user, brow raised, small "o"
  pleading: { eyeGaze: "viewer", eyebrows: "raised", mouth: "o", blush: false },
  // Spec: `unsure` — one eye bigger, tilted brow, flat shifted mouth
  confused: { eyeGaze: "side-to-side", eyebrows: "angled-in", mouth: "frown", blush: false },
  // Spec: never angry — "regroup" after 3 failures, deep breath, calm
  frustrated: { eyeGaze: "monitor", eyebrows: "lowered", mouth: "flat", blush: false },
  // Spec: `celebrate` — happy squint arcs, small smile
  proud: { eyeGaze: "viewer", eyebrows: "raised", mouth: "grin", blush: true },
  // Spec: `sleepy` — 60% closed, drooped brow, flat mouth
  sleepy: { eyeGaze: "down", eyebrows: "neutral", mouth: "flat", blush: false },
  // Spec: `receive` — eyes widen, alert
  surprised: { eyeGaze: "viewer", eyebrows: "raised", mouth: "o", blush: false }
};
