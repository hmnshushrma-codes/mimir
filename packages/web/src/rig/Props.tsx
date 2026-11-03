import { motion } from "framer-motion";
import type { Pose, PropsConfig } from "./types.js";

const INK = "#1b1d23";

function Chair({ pose }: { pose: Pose }) {
  const tilt = pose === "leaning-back" ? -14 : 0;
  return (
    <motion.g
      animate={{ rotate: tilt }}
      transition={{ duration: 0.3 }}
      style={{ transformOrigin: "60px 118px" }}
    >
      <rect x={30} y={60} width={6} height={58} rx={3} fill="#5a4a38" />
      <rect x={84} y={60} width={6} height={58} rx={3} fill="#5a4a38" />
      <rect x={28} y={56} width={64} height={10} rx={4} fill="#6b5842" />
    </motion.g>
  );
}

function Desk({ pose }: { pose: Pose }) {
  if (pose === "standing" || pose === "jumping") return null;
  return (
    <g>
      <rect x={8} y={112} width={140} height={8} rx={2} fill="#9e7e5a" />
      <rect x={12} y={120} width={132} height={26} rx={2} fill="#7a5f42" />
    </g>
  );
}

function Monitor({ content, teamColor }: { content: PropsConfig["monitorContent"]; teamColor: string }) {
  return (
    <g transform="translate(96,80)">
      <rect x={0} y={0} width={46} height={32} rx={3} fill="#1a1d24" stroke={INK} strokeWidth={1.5} />
      <rect x={18} y={32} width={10} height={5} fill="#555" />
      <rect x={10} y={37} width={26} height={3} rx={1.5} fill="#555" />

      {content === "code" && (
        <g transform="translate(4,4)">
          {[0, 5, 10, 15, 20].map((y, i) => (
            <rect key={i} x={2} y={y + 2} width={14 + ((i * 7) % 18)} height={1.6} rx={0.8} fill={teamColor} opacity={0.3 + (i % 3) * 0.15} />
          ))}
        </g>
      )}
      {content === "book-page" && (
        <g transform="translate(4,4)">
          <rect x={2} y={2} width={38} height={24} rx={1} fill="#fff" opacity={0.08} />
        </g>
      )}
      {content === "done-check" && (
        <g transform="translate(23,16)">
          <circle r={11} fill={teamColor} opacity={0.25} />
          <path d="M-5 0 L-1 5 L6 -6" stroke={teamColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {content === "dim" && <rect x={4} y={14} width={6} height={2} rx={1} fill={teamColor} opacity={0.15} />}
      {content === "awaiting-prompt" && (
        <g transform="translate(4,4)">
          <text x={0} y={22} fontSize={14} fontFamily="monospace" fill={teamColor} opacity={0.8}>{">"}</text>
          <rect x={10} y={12} width={7} height={12} fill={teamColor} opacity={0.8} />
        </g>
      )}
    </g>
  );
}

function Keyboard({ active, teamColor }: { active: boolean; teamColor: string }) {
  return (
    <g transform="translate(60,122)">
      <rect x={0} y={0} width={44} height={6} rx={2} fill="#555" opacity={0.6} />
      {active && (
        <>
          <motion.rect
            x={4} y={-2} width={6} height={4} rx={2} fill={teamColor} opacity={0.6}
            animate={{ y: [-2, -4, -2] }} transition={{ duration: 0.4, repeat: Infinity }}
          />
          <motion.rect
            x={32} y={-2} width={6} height={4} rx={2} fill={teamColor} opacity={0.6}
            animate={{ y: [-2, -4, -2] }} transition={{ duration: 0.35, repeat: Infinity }}
          />
        </>
      )}
    </g>
  );
}

function Mug() {
  return (
    <g transform="translate(20,126)">
      <rect x={0} y={0} width={10} height={12} rx={2} fill="#e07040" />
      <rect x={10} y={3} width={5} height={4} rx={2} fill="none" stroke="#e07040" strokeWidth={1.5} />
    </g>
  );
}

function Book() {
  return (
    <g transform="translate(40,20) rotate(-6)">
      <path d="M-14 0 Q0 -5 14 0 L14 18 Q0 13 -14 18 Z" fill="#fff" stroke={INK} strokeWidth={1} />
      <line x1={0} y1={0} x2={0} y2={18} stroke={INK} strokeWidth={0.8} opacity={0.5} />
    </g>
  );
}

function Phone() {
  return (
    <g transform="translate(26,108) rotate(-10)">
      <rect x={0} y={0} width={14} height={22} rx={2.5} fill="#1a1a1a" stroke="#333" strokeWidth={0.8} />
      <rect x={2} y={2.5} width={10} height={15} rx={1.2} fill="#3a6da8" opacity={0.6} />
    </g>
  );
}

function Radio() {
  return (
    <g transform="translate(130,128)">
      <rect x={0} y={0} width={16} height={10} rx={2} fill="#555" />
      <circle cx={4} cy={5} r={2} fill="#333" />
      <circle cx={12} cy={5} r={2} fill="#333" />
      <line x1={14} y1={0} x2={17} y2={-6} stroke="#777" strokeWidth={1} />
    </g>
  );
}

function Signs({ yes, no }: { yes: boolean; no: boolean }) {
  return (
    <g transform="translate(0,30)">
      {yes && (
        <g transform="translate(2,0)">
          <rect x={0} y={0} width={22} height={16} rx={2} fill="#1baf7a" stroke="#fff" strokeWidth={1} />
          <text x={11} y={11} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">YES</text>
        </g>
      )}
      {no && (
        <g transform="translate(96,0)">
          <rect x={0} y={0} width={22} height={16} rx={2} fill="#e34948" stroke="#fff" strokeWidth={1} />
          <text x={11} y={11} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">NO</text>
        </g>
      )}
    </g>
  );
}

/** The desk/props layer — everything attached to the scene around the
 *  character, driven entirely by `PropsConfig` (never by state directly). */
export function Props({ props, pose, teamColor }: { props: PropsConfig; pose: Pose; teamColor: string }) {
  return (
    <g>
      <Chair pose={pose} />
      <Desk pose={pose} />
      {props.showMonitor && pose !== "standing" && pose !== "jumping" && (
        <Monitor content={props.monitorContent} teamColor={teamColor} />
      )}
      {props.showKeyboard && pose !== "standing" && pose !== "jumping" && (
        <Keyboard active={props.keyboardActive} teamColor={teamColor} />
      )}
      {props.showMug && <Mug />}
      {props.showBook && <Book />}
      {props.showRadio && <Radio />}
      {props.showPhone && props.phonePosition === "in-hand" && <Phone />}
      {props.signs && <Signs yes={props.signs.yes} no={props.signs.no} />}
    </g>
  );
}
