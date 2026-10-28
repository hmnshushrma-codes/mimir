import { motion } from "framer-motion";
import type { ActionCategory, Mood } from "@agent-workshop/shared";
import { CHARACTER_PALETTE } from "./palette.js";
import { lighten, contrastCapColor } from "./colorUtils.js";
import { MoodIcon } from "./MoodIcon.js";
import { Face } from "./Face.js";
import { RoleAccessory } from "./RoleAccessory.js";
import { deriveFaceFeatures } from "./faceFeatures.js";
import { teamColorFor } from "./teamColor.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";

export interface CharacterProps {
  agentId: string;
  agentType: string | null;
  sessionId: string;
  isForeman: boolean;
  mood: Mood;
  category: ActionCategory | null;
  scale?: number;
  reducedMotion?: boolean;
}

// Body posture is keyed by mood, not lifecycle — a presentational detail, not
// a state-machine one. The 300ms transition on the wrapping motion.g (see
// below) is what keeps rapid mood changes from flickering between poses.
const bodyVariants = {
  focused: { y: [0, -6, 0], rotate: 0, transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" } },
  concentrating: { y: [0, -3, 0], rotate: 0, transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } },
  worried: { y: [0, -12, 0], rotate: 0, transition: { duration: 0.6, repeat: Infinity, repeatDelay: 0.3, ease: "easeOut" } },
  dizzy: { x: [0, -5, 5, -5, 0], rotate: 0, transition: { duration: 0.4 } },
  frustrated: { x: [0, -6, 6, -6, 0], rotate: 0, transition: { duration: 0.35, repeat: Infinity, repeatDelay: 0.4 } },
  sleepy: { y: [0, -2, 0], rotate: 0, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } },
  excited: { y: [0, -10, 0], rotate: [0, -3, 3, 0], transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" } },
  proud: { y: [0, -10, 0], rotate: 0, transition: { duration: 0.5 } },
  neutral: { y: 0, rotate: 0, transition: { duration: 0.3 } }
};

export function Character({
  agentId,
  agentType,
  sessionId,
  isForeman,
  mood,
  category,
  scale = 1,
  reducedMotion = false
}: CharacterProps) {
  const isDark = usePrefersDarkMode();
  const { colorIndex, pattern } = teamColorFor(sessionId);
  const palette = CHARACTER_PALETTE[colorIndex % CHARACTER_PALETTE.length];
  const teamColor = isDark ? palette.dark : palette.light;
  const fill = isForeman ? teamColor : lighten(teamColor, 0.35);
  const capColor = contrastCapColor(fill);
  const features = deriveFaceFeatures(agentId, agentType);

  const armRaised = mood === "worried";
  const holdingPhone = mood === "sleepy" || mood === "proud" || mood === "neutral";

  return (
    <svg width={120 * scale} height={150 * scale} viewBox="0 0 120 150" style={{ "--eyelid-color": fill } as React.CSSProperties}>
      <ellipse cx={60} cy={140} rx={34} ry={7} fill="#000" opacity={0.12} />
      {mood === "worried" && !reducedMotion && (
        <motion.circle
          cx={60}
          cy={90}
          r={46}
          fill="none"
          stroke={teamColor}
          strokeWidth={3}
          animate={{ opacity: [0.7, 0.1, 0.7], scale: [1, 1.08, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "60px 90px" }}
        />
      )}
      <motion.g animate={reducedMotion ? undefined : mood} variants={bodyVariants} transition={{ duration: 0.3 }}>
        {/* legs */}
        <rect x={40} y={110} width={12} height={22} rx={6} fill={fill} />
        <rect x={68} y={110} width={12} height={22} rx={6} fill={fill} />
        {/* body */}
        <ellipse cx={60} cy={92} rx={38} ry={40} fill={fill} />
        <ellipse cx={60} cy={100} rx={20} ry={18} fill="#ffffff" opacity={0.22} />
        {/* arms */}
        {holdingPhone ? (
          <g>
            {/* Left arm angled to hold phone */}
            <rect x={18} y={72} width={14} height={28} rx={7} fill={fill}
              transform="rotate(30 25 86)" />
            {/* Phone in hand */}
            <g transform="translate(6, 64) rotate(15)">
              <rect x={0} y={0} width={12} height={20} rx={2} fill="#222" stroke="#444" strokeWidth={0.8} />
              {/* Phone screen glow */}
              <rect x={1.5} y={2} width={9} height={14} rx={1} fill="#4488cc" opacity={0.6} />
              {/* Content lines on screen */}
              <rect x={3} y={5} width={6} height={1} rx={0.5} fill="#fff" opacity={0.4} />
              <rect x={3} y={8} width={5} height={1} rx={0.5} fill="#fff" opacity={0.3} />
              <rect x={3} y={11} width={7} height={1} rx={0.5} fill="#fff" opacity={0.35} />
            </g>
          </g>
        ) : (
          <rect x={16} y={78} width={14} height={30} rx={7} fill={fill} />
        )}
        <motion.rect
          x={90}
          y={78}
          width={14}
          height={30}
          rx={7}
          fill={fill}
          animate={armRaised ? { rotate: -110 } : { rotate: 0 }}
          style={{ transformOrigin: "97px 80px" }}
          transition={{ duration: 0.3 }}
        />
        {/* head */}
        <circle cx={60} cy={56} r={34} fill={fill} />
        <Face features={features} mood={mood} />
        <RoleAccessory role={features.role} unknownAccessory={features.unknownAccessory} color={teamColor} pattern={pattern} capColor={capColor} />
        <MoodIcon mood={mood} category={category} reducedMotion={reducedMotion} />
      </motion.g>
    </svg>
  );
}
