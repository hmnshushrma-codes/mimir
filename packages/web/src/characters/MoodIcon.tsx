import { motion } from "framer-motion";
import type { Mood, ActionCategory } from "@agent-workshop/shared";

const INK = "#1b1d23";

function MagnifyingGlass({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(82,6)"
      animate={animate ? { rotate: [-10, 10, -10] } : undefined}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx={0} cy={0} r={8} fill="none" stroke={INK} strokeWidth={3} />
      <line x1={6} y1={6} x2={15} y2={15} stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </motion.g>
  );
}

function Hammer({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(88,14)"
      animate={animate ? { rotate: [0, -35, 0] } : undefined}
      transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "0px 14px" }}
    >
      <rect x={-2} y={0} width={5} height={20} rx={2} fill={INK} />
      <rect x={-9} y={-6} width={18} height={9} rx={3} fill={INK} />
    </motion.g>
  );
}

function Terminal({ animate }: { animate: boolean }) {
  return (
    <g transform="translate(78,4)">
      <rect x={0} y={0} width={26} height={18} rx={3} fill={INK} />
      <motion.rect
        x={4}
        y={5}
        width={6}
        height={3}
        fill="#4fd37a"
        animate={animate ? { opacity: [1, 0, 1] } : undefined}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
      <motion.g animate={animate ? { opacity: [0, 1, 0], y: [0, -6] } : undefined} transition={{ duration: 0.4, repeat: Infinity }}>
        <path d="M28 2 l5 -3 M30 6 l6 0 M28 10 l5 3" stroke="#eda100" strokeWidth={2} strokeLinecap="round" />
      </motion.g>
    </g>
  );
}

function Binoculars({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(80,8)"
      animate={animate ? { y: [0, -3, 0] } : undefined}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <rect x={6} y={4} width={10} height={4} fill={INK} />
      <circle cx={6} cy={10} r={7} fill={INK} />
      <circle cx={22} cy={10} r={7} fill={INK} />
    </motion.g>
  );
}

function Phone({ animate }: { animate: boolean }) {
  return (
    <g transform="translate(86,6)">
      <rect x={0} y={0} width={14} height={22} rx={4} fill={INK} />
      <motion.g animate={animate ? { opacity: [0.2, 1, 0.2] } : undefined} transition={{ duration: 1, repeat: Infinity }}>
        <path d="M18 6 q6 5 0 10" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d="M22 2 q12 10 0 20" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      </motion.g>
    </g>
  );
}

function WavingHand({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(92,10)"
      animate={animate ? { rotate: [-15, 20, -15] } : undefined}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "0px 14px" }}
    >
      <ellipse cx={0} cy={0} rx={7} ry={9} fill="#f2c88c" />
      <rect x={-7} y={-10} width={4} height={8} rx={2} fill="#f2c88c" />
      <rect x={-1} y={-12} width={4} height={10} rx={2} fill="#f2c88c" />
      <rect x={5} y={-10} width={4} height={8} rx={2} fill="#f2c88c" />
    </motion.g>
  );
}

function QuestionBubble({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(85,2)"
      animate={animate ? { scale: [1, 1.2, 1] } : undefined}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "10px 10px" }}
    >
      <circle cx={10} cy={10} r={13} fill="#eda100" stroke="#fff" strokeWidth={1.5} />
      <text x={10} y={15} textAnchor="middle" fontSize={17} fontWeight={700} fill="#1b1d23">
        ?
      </text>
    </motion.g>
  );
}

function SmokeAndStars({ animate, intense }: { animate: boolean; intense: boolean }) {
  const smokeColor = intense ? "#9a9a96" : "#c3c2b7";
  return (
    <g transform="translate(78,-4)">
      <motion.g
        animate={animate ? { y: [0, -6, 0], opacity: [0.5, 0.9, 0.5] } : undefined}
        transition={{ duration: intense ? 1 : 1.6, repeat: Infinity }}
      >
        <circle cx={6} cy={10} r={6} fill={smokeColor} />
        <circle cx={14} cy={4} r={5} fill={smokeColor} />
        <circle cx={20} cy={10} r={4} fill={smokeColor} />
        {intense && <circle cx={10} cy={-2} r={3} fill={smokeColor} />}
      </motion.g>
      <motion.text
        x={30}
        y={6}
        fontSize={14}
        fill={intense ? "#d64545" : "#eda100"}
        animate={animate ? { rotate: [0, 25, 0], opacity: [1, 0.4, 1] } : undefined}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        ✦
      </motion.text>
    </g>
  );
}

function SleepZzz({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(84,-6)"
      animate={animate ? { y: [0, -8], opacity: [0, 1, 0] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
    >
      <text x={0} y={18} fontSize={10} fill="#898781" fontWeight={700}>
        z
      </text>
      <text x={7} y={10} fontSize={13} fill="#898781" fontWeight={700}>
        z
      </text>
      <text x={16} y={0} fontSize={16} fill="#898781" fontWeight={700}>
        Z
      </text>
    </motion.g>
  );
}

function ThumbsUp({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(86,6)"
      animate={animate ? { scale: [0.8, 1.15, 1] } : undefined}
      transition={{ duration: 0.4 }}
      style={{ transformOrigin: "10px 14px" }}
    >
      <rect x={2} y={10} width={12} height={14} rx={3} fill="#f2c88c" />
      <rect x={8} y={0} width={8} height={14} rx={4} fill="#f2c88c" />
    </motion.g>
  );
}

function SweatDrop({ animate }: { animate: boolean }) {
  // Positioned at the opposite temple from the category icon (which lives
  // around x=78-92, y=0-14) so "concentrating" never hides one behind the
  // other — a real bug caught in visual verification (see the mood screenshot
  // review): they used to sit at nearly identical coordinates.
  return (
    <motion.g
      transform="translate(28,36) scale(1.3)"
      animate={animate ? { y: [0, 4, 0], opacity: [0.7, 1, 0.7] } : undefined}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M0 0 C 6 8 6 14 0 14 C -6 14 -6 8 0 0 Z" fill="#6fb8f0" stroke="#fff" strokeWidth={0.5} />
    </motion.g>
  );
}

const CATEGORY_ICON: Partial<Record<ActionCategory, (animate: boolean) => JSX.Element>> = {
  read: (a) => <MagnifyingGlass animate={a} />,
  write: (a) => <Hammer animate={a} />,
  shell: (a) => <Terminal animate={a} />,
  web: (a) => <Binoculars animate={a} />,
  mcp: (a) => <Phone animate={a} />
};

export function MoodIcon({
  mood,
  category,
  reducedMotion
}: {
  mood: Mood;
  category: ActionCategory | null;
  reducedMotion: boolean;
}) {
  const animate = !reducedMotion;

  switch (mood) {
    case "worried":
      return <QuestionBubble animate={animate} />;
    case "dizzy":
      return <SmokeAndStars animate={animate} intense={false} />;
    case "frustrated":
      return <SmokeAndStars animate={animate} intense />;
    case "sleepy":
      return <SleepZzz animate={animate} />;
    case "excited":
      return <WavingHand animate={animate} />;
    case "proud":
      return <ThumbsUp animate={animate} />;
    case "concentrating":
      return (
        <>
          {category && category in CATEGORY_ICON ? CATEGORY_ICON[category]!(animate) : null}
          <SweatDrop animate={animate} />
        </>
      );
    case "focused":
      return category && category in CATEGORY_ICON ? CATEGORY_ICON[category]!(animate) : null;
    default:
      return null;
  }
}
