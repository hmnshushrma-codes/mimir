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
 * Each expression's eyes/eyebrows/mouth/cheeks preset. Does NOT control
 * whether the eyes are open or closed — that's `Behaviour.eyesClosed`,
 * reserved exclusively for "sleeping" (see behaviourFor.ts), so a "sleepy"
 * expression preset here just sets the gaze direction the half-lidded eyes
 * use elsewhere (e.g. "stalled"), not a closed-eye shape.
 */
export const EXPRESSION_PRESETS: Record<Expression, ExpressionPreset> = {
  focused: { eyeGaze: "monitor", eyebrows: "neutral", mouth: "flat", blush: false },
  happy: { eyeGaze: "viewer", eyebrows: "neutral", mouth: "smile", blush: true },
  curious: { eyeGaze: "side-to-side", eyebrows: "raised", mouth: "o", blush: false },
  worried: { eyeGaze: "viewer", eyebrows: "worried", mouth: "wobbly", blush: false },
  pleading: { eyeGaze: "viewer", eyebrows: "worried", mouth: "wobbly", blush: false },
  confused: { eyeGaze: "side-to-side", eyebrows: "angled-in", mouth: "wobbly", blush: false },
  frustrated: { eyeGaze: "viewer", eyebrows: "lowered", mouth: "frown", blush: false },
  proud: { eyeGaze: "viewer", eyebrows: "raised", mouth: "grin", blush: true },
  sleepy: { eyeGaze: "down", eyebrows: "neutral", mouth: "flat", blush: false },
  surprised: { eyeGaze: "viewer", eyebrows: "raised", mouth: "o", blush: false }
};
