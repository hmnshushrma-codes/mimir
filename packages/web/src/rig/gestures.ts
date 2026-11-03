import type { GestureName } from "./types.js";

export const GESTURES: GestureName[] = [
  "wave",
  "raise-hand",
  "nod-yes",
  "shake-no",
  "shrug",
  "thumbs-up",
  "scratch-head",
  "facepalm",
  "stretch",
  "sip-tea",
  "drum-fingers",
  "point",
  "clap"
];

/** Rotation keyframes in degrees, relative to the arm's resting pose
 *  (upperRotate pivots at the shoulder, forearmRotate at the elbow). */
export interface ArmAnimation {
  upperRotate: number[];
  forearmRotate: number[];
}

export interface GesturePreset {
  label: string;
  durationMs: number;
  armL: ArmAnimation | null;
  armR: ArmAnimation | null;
  /** nod-yes / shake-no are head gestures, not arm gestures. */
  headRotate: number[] | null;
  /** True if this gesture should hold its final frame rather than return to rest (e.g. thumbs-up before "done" settles). */
  hold: boolean;
}

const REST: ArmAnimation = { upperRotate: [0], forearmRotate: [0] };

export const GESTURE_PRESETS: Record<GestureName, GesturePreset> = {
  wave: {
    label: "Wave",
    durationMs: 800,
    armL: REST,
    armR: { upperRotate: [-70, -70, -70, -70], forearmRotate: [0, -30, 10, -25] },
    headRotate: [0, 3, -3, 0],
    hold: false
  },
  "raise-hand": {
    label: "Raise hand",
    durationMs: 600,
    armL: REST,
    armR: { upperRotate: [0, -120, -115, -120], forearmRotate: [0, -10, 5, -10] },
    headRotate: [0, 5, 0],
    hold: false
  },
  "nod-yes": {
    label: "Nod yes",
    durationMs: 600,
    armL: REST,
    armR: REST,
    headRotate: [0, 12, -4, 8, 0],
    hold: false
  },
  "shake-no": {
    label: "Shake no",
    durationMs: 600,
    armL: REST,
    armR: REST,
    headRotate: [0, -14, 14, -10, 0],
    hold: false
  },
  shrug: {
    label: "Shrug",
    durationMs: 500,
    armL: { upperRotate: [0, -30], forearmRotate: [0, -40] },
    armR: { upperRotate: [0, -30], forearmRotate: [0, -40] },
    headRotate: null,
    hold: false
  },
  "thumbs-up": {
    label: "Thumbs up",
    durationMs: 400,
    armL: REST,
    armR: { upperRotate: [0, -60], forearmRotate: [0, -90] },
    headRotate: null,
    hold: true
  },
  "scratch-head": {
    label: "Scratch head",
    durationMs: 1200,
    armL: REST,
    armR: { upperRotate: [0, -140, -135, -140], forearmRotate: [0, -60, -50, -60] },
    headRotate: null,
    hold: false
  },
  facepalm: {
    label: "Facepalm",
    durationMs: 500,
    armL: REST,
    armR: { upperRotate: [0, -150], forearmRotate: [0, -100] },
    headRotate: [0, 8],
    hold: true
  },
  stretch: {
    label: "Stretch",
    durationMs: 1000,
    armL: { upperRotate: [0, -170], forearmRotate: [0, 0] },
    armR: { upperRotate: [0, -170], forearmRotate: [0, 0] },
    headRotate: null,
    hold: false
  },
  "sip-tea": {
    label: "Chin think",
    durationMs: 2400,
    armL: REST,
    armR: { upperRotate: [0, -80, -80, 0], forearmRotate: [0, -100, -95, 0] },
    headRotate: [0, -3, 3, 0],
    hold: false
  },
  "drum-fingers": {
    label: "Drum fingers",
    durationMs: 1400,
    armL: REST,
    armR: { upperRotate: [10, 10, 10], forearmRotate: [60, 55, 60] },
    headRotate: null,
    hold: false
  },
  point: {
    label: "Point at screen",
    durationMs: 400,
    armL: REST,
    armR: { upperRotate: [0, -80], forearmRotate: [0, -20] },
    headRotate: null,
    hold: true
  },
  clap: {
    label: "Clap",
    durationMs: 700,
    armL: { upperRotate: [0, -60, -60], forearmRotate: [0, -70, -50] },
    armR: { upperRotate: [0, -60, -60], forearmRotate: [0, -70, -50] },
    headRotate: null,
    hold: false
  }
};
