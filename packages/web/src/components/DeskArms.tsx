import { motion } from "framer-motion";
import type { Behaviour } from "../rig/types.js";

type ArmPose = "rest" | "type" | "raise" | "raise-right-only";

function deriveArmPose(behaviour: Behaviour): ArmPose {
  if (behaviour.props.signs?.yes || behaviour.props.signs?.no) return "raise";
  if (behaviour.gesture?.name === "raise-hand" && behaviour.gesture.playing) return "raise-right-only";
  if (behaviour.activityLoop === "typing") return "type";
  return "rest";
}

interface ArmTarget {
  ex: number; ey: number;
  hx: number; hy: number;
}

interface DeskArmsProps {
  cx: number;
  shoulderY: number;
  shoulderSpread: number;
  behaviour: Behaviour;
  teamColor: string;
  reducedMotion: boolean;
  armWidth?: number;
  handRadius?: number;
  scale?: number;
  /** Callback when YES sign is clicked (allow permission). */
  onSignYes?: () => void;
  /** Callback when NO sign is clicked (deny permission). */
  onSignNo?: () => void;
}

const TARGETS_L: Record<ArmPose, ArmTarget> = {
  rest:               { ex: -10, ey: 16, hx: -10, hy: 34 },
  type:               { ex: -6,  ey: 18, hx: 0,   hy: 36 },
  raise:              { ex: -12, ey: 0,  hx: -14, hy: -14 },
  "raise-right-only": { ex: -10, ey: 16, hx: -10, hy: 34 },
};
const TARGETS_R: Record<ArmPose, ArmTarget> = {
  rest:               { ex: 10,  ey: 16, hx: 10,  hy: 34 },
  type:               { ex: 6,   ey: 18, hx: 0,   hy: 36 },
  raise:              { ex: 12,  ey: 0,  hx: 14,  hy: -14 },
  "raise-right-only": { ex: 12,  ey: 0,  hx: 14,  hy: -14 },
};

function SmoothArm({
  sx, sy, target, fill, armWidth, handRadius, typing, isLeft, reducedMotion
}: {
  sx: number; sy: number;
  target: ArmTarget;
  fill: string;
  armWidth: number;
  handRadius: number;
  typing: boolean;
  isLeft: boolean;
  reducedMotion: boolean;
}) {
  const handX = sx + target.hx;
  const handY = sy + target.hy;
  const elbowX = sx + target.ex;
  const elbowY = sy + target.ey;

  const bounceY = typing && !reducedMotion ? [0, -3, 0, -1.5, 0] : [0];
  const bounceDur = isLeft ? 0.45 : 0.4;

  return (
    <motion.g
      animate={{ y: bounceY }}
      transition={{
        duration: bounceDur,
        repeat: typing && !reducedMotion ? Infinity : 0,
        ease: "easeInOut"
      }}
    >
      <motion.path
        stroke={fill}
        strokeWidth={armWidth}
        strokeLinecap="round"
        fill="none"
        animate={{
          d: `M${sx},${sy} Q${elbowX},${elbowY} ${handX},${handY}`
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <motion.circle
        r={handRadius}
        fill={fill}
        animate={{ cx: handX, cy: handY }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </motion.g>
  );
}

/** YES/NO sign rendered at an absolute SVG position — NOT a child
 *  of the arm chain, so no compounding transform issues. */
function Sign({ x, y, label, color, onClick }: { x: number; y: number; label: string; color: string; onClick?: () => void }) {
  return (
    <motion.g
      animate={{ x, y }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <rect x={-13} y={-8} width="26" height="16" rx="3" fill={color} stroke="#fff" strokeWidth="1" />
      {onClick && (
        <rect x={-13} y={-8} width="26" height="16" rx="3" fill="transparent" className="sign-hover-target" />
      )}
      <text x={0} y={4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{label}</text>
    </motion.g>
  );
}

export function DeskArms({
  cx, shoulderY, shoulderSpread,
  behaviour, teamColor, reducedMotion,
  armWidth = 10, handRadius = 6, scale = 1,
  onSignYes, onSignNo,
}: DeskArmsProps) {
  const pose = deriveArmPose(behaviour);
  const typing = behaviour.activityLoop === "typing";

  const tL = TARGETS_L[pose];
  const tR = TARGETS_R[pose];
  const sL: ArmTarget = { ex: tL.ex * scale, ey: tL.ey * scale, hx: tL.hx * scale, hy: tL.hy * scale };
  const sR: ArmTarget = { ex: tR.ex * scale, ey: tR.ey * scale, hx: tR.hx * scale, hy: tR.hy * scale };

  const lSx = cx - shoulderSpread;
  const rSx = cx + shoulderSpread;

  // Compute absolute sign positions from shoulder + hand offset
  const showYes = behaviour.props.signs?.yes;
  const showNo = behaviour.props.signs?.no;
  const signLx = lSx + sL.hx;
  const signLy = shoulderY + sL.hy - handRadius * scale - 12;
  const signRx = rSx + sR.hx;
  const signRy = shoulderY + sR.hy - handRadius * scale - 12;

  return (
    <g>
      <SmoothArm
        sx={lSx} sy={shoulderY}
        target={sL}
        fill={teamColor}
        armWidth={armWidth * scale}
        handRadius={handRadius * scale}
        typing={typing}
        isLeft={true}
        reducedMotion={reducedMotion}
      />
      <SmoothArm
        sx={rSx} sy={shoulderY}
        target={sR}
        fill={teamColor}
        armWidth={armWidth * scale}
        handRadius={handRadius * scale}
        typing={typing}
        isLeft={false}
        reducedMotion={reducedMotion}
      />
      {/* Signs rendered as siblings, not arm children — absolute positions */}
      {showYes && <Sign x={signLx} y={signLy} label="YES" color="#1baf7a" onClick={onSignYes} />}
      {showNo && <Sign x={signRx} y={signRy} label="NO" color="#e34948" onClick={onSignNo} />}
    </g>
  );
}
