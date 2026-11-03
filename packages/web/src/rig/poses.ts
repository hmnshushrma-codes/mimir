import type { Pose } from "./types.js";

export const POSES: Pose[] = ["sitting", "standing", "leaning-back", "leaning-forward", "jumping"];

export interface PosePreset {
  label: string;
  legPose: "sit" | "stand" | "dangle";
  /** Degrees the body leans — positive = back, negative = forward. */
  bodyLeanDeg: number;
  /** Root y-offset (px) — jumping lifts the whole character. */
  rootLiftPx: number;
}

export const POSE_PRESETS: Record<Pose, PosePreset> = {
  sitting: { label: "Sitting at desk", legPose: "sit", bodyLeanDeg: 0, rootLiftPx: 0 },
  standing: { label: "Standing", legPose: "stand", bodyLeanDeg: 0, rootLiftPx: 0 },
  "leaning-back": { label: "Leaning back", legPose: "dangle", bodyLeanDeg: 12, rootLiftPx: 0 },
  "leaning-forward": { label: "Leaning forward", legPose: "sit", bodyLeanDeg: -3, rootLiftPx: 0 },
  jumping: { label: "Jumping", legPose: "stand", bodyLeanDeg: 0, rootLiftPx: -18 }
};
