import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { hashString } from "@agent-workshop/shared";
import type { Behaviour } from "./types.js";
import { POSE_PRESETS } from "./poses.js";
import { EXPRESSION_PRESETS, type EyeGaze, type EyebrowPose, type MouthShape } from "./expressions.js";
import { GESTURE_PRESETS } from "./gestures.js";
import { Props } from "./Props.js";
import { Effects } from "./Effects.js";
import type { BehaviourContext } from "./types.js";

const INK = "#1b1d23";

/** Deterministic per-instance idle timing, so characters never blink/breathe
 *  in lockstep — each agent seeds its own offsets from its id. */
function idleSeed(seed: string) {
  const h = hashString(seed);
  return {
    blinkDelay: (h % 30) / 10, // 0-3s
    blinkInterval: 3 + ((h >> 4) % 30) / 10, // 3-6s
    breathDelay: ((h >> 8) % 20) / 10
  };
}

function gazeOffset(gaze: EyeGaze): { x: number; y: number } {
  switch (gaze) {
    case "viewer":
      return { x: 0, y: 0 };
    case "monitor":
      return { x: 2, y: 1 };
    case "up-side":
      return { x: 2, y: -2 };
    case "down":
      return { x: 0, y: 2 };
    case "side-to-side":
      return { x: 0, y: 0 }; // animated, see Eyes component
  }
}

function Eyes({ gaze, closed, seed, reducedMotion }: { gaze: EyeGaze; closed: boolean; seed: ReturnType<typeof idleSeed>; reducedMotion: boolean }) {
  if (closed) {
    return (
      <>
        <path d="M11 0 q7 5 14 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M35 0 q7 5 14 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </>
    );
  }
  const offset = gazeOffset(gaze);
  const animate = gaze === "side-to-side" && !reducedMotion ? { x: [offset.x, -2, 2, 0] } : { x: offset.x, y: offset.y };
  return (
    <>
      <ellipse cx={18} cy={0} rx={7.5} ry={8} fill="#fff" />
      <ellipse cx={42} cy={0} rx={7.5} ry={8} fill="#fff" />
      <motion.circle cx={18} cy={0} r={5.5} fill={INK} animate={animate} transition={{ duration: 1.4, repeat: gaze === "side-to-side" ? Infinity : 0 }} />
      <motion.circle cx={42} cy={0} r={5.5} fill={INK} animate={animate} transition={{ duration: 1.4, repeat: gaze === "side-to-side" ? Infinity : 0 }} />
      {/* eye shine — small white dot top-right of each pupil for life */}
      <motion.circle cx={20.5} cy={-2} r={1.5} fill="#fff" animate={animate} transition={{ duration: 1.4, repeat: gaze === "side-to-side" ? Infinity : 0 }} />
      <motion.circle cx={44.5} cy={-2} r={1.5} fill="#fff" animate={animate} transition={{ duration: 1.4, repeat: gaze === "side-to-side" ? Infinity : 0 }} />
      {!reducedMotion && (
        <>
          <ellipse cx={18} cy={0} rx={8.5} ry={9} fill={INK} className="eyelid" style={{ animationDelay: `${seed.blinkDelay}s`, animationDuration: `${seed.blinkInterval}s` }} />
          <ellipse cx={42} cy={0} rx={8.5} ry={9} fill={INK} className="eyelid" style={{ animationDelay: `${seed.blinkDelay + 0.04}s`, animationDuration: `${seed.blinkInterval}s` }} />
        </>
      )}
    </>
  );
}

function Eyebrows({ pose }: { pose: EyebrowPose }) {
  const raised = pose === "raised";
  const worried = pose === "worried";
  const lowered = pose === "lowered";
  const baseY = raised ? -8 : worried ? -3 : lowered ? 2 : -2;
  const tilt = worried ? 1.5 : lowered ? -1.5 : 0;
  return (
    <>
      <path d={`M10 ${baseY - tilt * 3} q9 ${tilt * -4} 18 0`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <path d={`M34 ${baseY} q9 ${tilt * -4} 18 ${tilt * 3}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
    </>
  );
}

const MOUTH_PATHS: Record<MouthShape, string> = {
  smile: "M10 0 q10 8 20 0",
  grin: "M8 -2 q12 12 24 0 q-12 6 -24 0",
  flat: "M10 0 h20",
  o: "M20 -4 a4 6 0 1 0 0.1 0",
  wobbly: "M8 0 q4 -4 8 0 q4 4 8 0 q4 -4 8 0",
  frown: "M8 4 q10 -10 20 0",
  "open-talk": "M8 -2 q10 10 20 0 q-10 -4 -20 0",
  yawn: "M14 -6 a8 10 0 1 0 0.1 0"
};

function Mouth({ shape }: { shape: MouthShape }) {
  return (
    <AnimatePresence mode="wait">
      <motion.path
        key={shape}
        d={MOUTH_PATHS[shape]}
        stroke={INK}
        strokeWidth={2.5}
        fill={shape === "o" || shape === "yawn" ? INK : "none"}
        fillOpacity={shape === "o" || shape === "yawn" ? 0.85 : 1}
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
    </AnimatePresence>
  );
}

function Cheeks({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <circle cx={10} cy={10} r={4} fill="#e8889a" opacity={0.4} />
      <circle cx={50} cy={10} r={4} fill="#e8889a" opacity={0.4} />
    </>
  );
}

function Arm({
  side,
  gestureName,
  gesturePlaying,
  typing,
  idle,
  seated,
  fill,
  reducedMotion,
  seed
}: {
  side: "L" | "R";
  gestureName: Behaviour["gesture"];
  gesturePlaying: boolean;
  /** True when the character is actively typing. */
  typing: boolean;
  /** True when the character has no activity loop (resting). */
  idle: boolean;
  seated: boolean;
  fill: string;
  reducedMotion: boolean;
  seed: number;
}) {
  const isLeft = side === "L";
  const shoulderX = isLeft ? -40 : 40;
  const shoulderY = -10;
  const gesture = gestureName?.name ? GESTURE_PRESETS[gestureName.name] : null;
  const armAnim = gesture ? (isLeft ? gesture.armL : gesture.armR) : null;

  const restForearm = seated ? -100 : 0;
  let upperRotate: number | number[] = 0;
  let forearmRotate: number | number[] = restForearm;
  let upperDuration = 0.4;
  let forearmDuration = 0.4;
  let repeat: number | undefined;

  if (gesturePlaying && armAnim) {
    // Gesture animation — wave, raise-hand, thumbs-up, etc.
    upperRotate = armAnim.upperRotate;
    forearmRotate = armAnim.forearmRotate;
    upperDuration = (gesture?.durationMs ?? 400) / 1000;
    forearmDuration = upperDuration;
    repeat = gesture?.hold ? 0 : Infinity;
  } else if (typing && !reducedMotion) {
    // Two-handed typing: both arms bounce continuously with offset phase.
    // Left arm leads on even cycles, right arm leads on odd — creates a
    // natural alternating keystroke rhythm entirely in Framer Motion
    // keyframes, no React state needed.
    const big = restForearm - 16;
    const small = restForearm - 6;
    forearmRotate = isLeft
      ? [restForearm, big, restForearm, small, restForearm]
      : [restForearm, small, restForearm, big, restForearm];
    forearmDuration = 0.5;
    repeat = Infinity;
  } else if (idle && !reducedMotion && seated) {
    // Subtle idle sway — arms gently shift, seeded per agent
    const sway = 5;
    const offset = isLeft ? sway : -sway;
    forearmRotate = [restForearm, restForearm + offset, restForearm];
    forearmDuration = 3 + (seed % 10) / 5; // 3-5s, seeded
    repeat = Infinity;
  }

  return (
    <motion.g transform={`translate(${shoulderX},${shoulderY})`}>
      <motion.g
        animate={{ rotate: upperRotate }}
        transition={{ duration: upperDuration, repeat, ease: "easeInOut" }}
        style={{ transformOrigin: "0px 0px" }}
      >
        <rect x={isLeft ? -7 : 0} y={0} width={14} height={22} rx={7} fill={fill} />
        <motion.g
          animate={{ rotate: forearmRotate }}
          transition={{ duration: forearmDuration, repeat, ease: "easeInOut" }}
          style={{ transformOrigin: `${isLeft ? -3 : 3}px 20px` }}
        >
          <rect x={isLeft ? -6 : -1} y={18} width={13} height={20} rx={6.5} fill={fill} />
          <circle cx={isLeft ? -3 : 3} cy={40} r={7} fill="#f2c88c" />
        </motion.g>
      </motion.g>
    </motion.g>
  );
}

export interface RiggedCharacterProps {
  behaviour: Behaviour;
  behaviourContext: BehaviourContext;
  agentId: string;
  scale?: number;
  reducedMotion?: boolean;
  /** False when the caller draws its own desk/monitor/lamp (ForemanDesk,
   *  WorkerDesk) — renders the character only, so the generic desk/props
   *  layer below isn't double-drawn under a hand-drawn one. Default true. */
  renderProps?: boolean;
  /** False when the caller draws its own arms at the desk z-layer (DeskArms).
   *  Prevents the "4 hands" bug where RiggedCharacter arms are behind the
   *  desk AND desk-level arms are in front of it. Default true. */
  renderArms?: boolean;
}

/**
 * The one component every visual layer flows through. Reads ONLY
 * `behaviour` (+ `behaviourContext` for the effects allowlist check) —
 * never state/mood directly. See behaviourFor.ts for how a real agent's
 * state becomes a Behaviour.
 */
export function RiggedCharacter({ behaviour, behaviourContext, agentId, scale = 1, reducedMotion = false, renderProps = true, renderArms = true }: RiggedCharacterProps) {
  const seed = useMemo(() => idleSeed(agentId), [agentId]);
  const armSeed = useMemo(() => hashString(agentId), [agentId]);
  const pose = POSE_PRESETS[behaviour.pose];
  const expr = EXPRESSION_PRESETS[behaviour.expression];
  const fill = behaviour.teamColor;
  const isTyping = behaviour.activityLoop === "typing";
  const isIdle = behaviour.activityLoop === null;

  const breathing = !reducedMotion
    ? { scale: [1, 1.015, 1] }
    : undefined;

  return (
    <svg width={160 * scale} height={190 * scale} viewBox="0 -30 160 190" overflow="visible">
      <ellipse cx={80} cy={150} rx={38} ry={6} fill="#000" opacity={0.1} />

      {renderProps && <Props props={behaviour.props} pose={behaviour.pose} teamColor={fill} />}

      {/* root: position/jump */}
      <motion.g
        animate={{ y: pose.rootLiftPx }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* body: breathing + lean, pivot at hips */}
        <motion.g
          transform="translate(72,95)"
          animate={{ rotate: pose.bodyLeanDeg, ...(breathing ?? {}) }}
          transition={{ rotate: { duration: 0.3 }, scale: { duration: 2.4 + seed.breathDelay, repeat: Infinity, ease: "easeInOut" } }}
          style={{ transformOrigin: "0px 20px" }}
        >
          <ellipse cx={0} cy={0} rx={34} ry={36} fill={fill} />
          <ellipse cx={0} cy={-6} rx={18} ry={16} fill="#ffffff" opacity={0.15} />

          {/* arms, pivot at shoulder — hidden when desk components draw their own */}
          {renderArms && (
            <>
              <Arm side="L" gestureName={behaviour.gesture} gesturePlaying={Boolean(behaviour.gesture?.playing)} typing={isTyping} idle={isIdle} seated={pose.legPose === "sit"} fill={fill} reducedMotion={reducedMotion} seed={armSeed} />
              <Arm side="R" gestureName={behaviour.gesture} gesturePlaying={Boolean(behaviour.gesture?.playing)} typing={isTyping} idle={isIdle} seated={pose.legPose === "sit"} fill={fill} reducedMotion={reducedMotion} seed={armSeed} />
            </>
          )}

          {/* legs: only visible standing/leaning-back */}
          {pose.legPose === "stand" && (
            <>
              <rect x={-18} y={30} width={13} height={30} rx={6} fill={fill} />
              <rect x={5} y={30} width={13} height={30} rx={6} fill={fill} />
            </>
          )}
          {pose.legPose === "dangle" && (
            <motion.g animate={!reducedMotion ? { rotate: [0, 4, 0] } : undefined} transition={{ duration: 2, repeat: Infinity }} style={{ transformOrigin: "0px 30px" }}>
              <rect x={-18} y={30} width={13} height={26} rx={6} fill={fill} opacity={0.9} />
              <rect x={5} y={30} width={13} height={26} rx={6} fill={fill} opacity={0.9} />
            </motion.g>
          )}

          {/* head: tilt/nod, pivot at neck */}
          <motion.g
            transform="translate(0,-54)"
            animate={{
              rotate: behaviour.gesture?.playing && GESTURE_PRESETS[behaviour.gesture.name].headRotate
                ? GESTURE_PRESETS[behaviour.gesture.name].headRotate!
                : 0
            }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ transformOrigin: "0px 20px" }}
          >
            <circle cx={0} cy={0} r={30} fill={fill} />

            <g transform="translate(-30,-4)">
              <Eyes gaze={expr.eyeGaze} closed={behaviour.eyesClosed} seed={seed} reducedMotion={reducedMotion} />
            </g>
            <g transform="translate(-30,-14)">
              <Eyebrows pose={expr.eyebrows} />
            </g>
            <g transform="translate(-20,12)">
              <Mouth shape={expr.mouth} />
            </g>
            <Cheeks show={expr.blush} />
          </motion.g>
        </motion.g>
      </motion.g>

      <Effects effects={behaviour.effects} speechBubble={behaviour.speechBubble} ctx={behaviourContext} reducedMotion={reducedMotion} />
    </svg>
  );
}
