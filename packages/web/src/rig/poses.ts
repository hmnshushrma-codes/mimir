import type { Pose } from "./types.js";

export const POSES: Pose[] = ["sitting", "standing", "leaning-back", "jumping"];

export interface PosePreset {
  label: string;
  legPose: "sit" | "stand" | "dangle";
  /** Degrees the body leans back from vertical (leaning-back only). */
  bodyLeanDeg: number;
  /** Root y-offset (px) — jumping lifts the whole character. */
  rootLiftPx: number;
}

export const POSE_PRESETS: Record<Pose, PosePreset> = {
  sitting: { label: "Sitting at desk", legPose: "sit", bodyLeanDeg: 0, rootLiftPx: 0 },
  standing: { label: "Standing", legPose: "stand", bodyLeanDeg: 0, rootLiftPx: 0 },
  "leaning-back": { label: "Leaning back", legPose: "dangle", bodyLeanDeg: 12, rootLiftPx: 0 },
  jumping: { label: "Jumping", legPose: "stand", bodyLeanDeg: 0, rootLiftPx: -18 }
};
