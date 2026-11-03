import { motion } from "framer-motion";
import { filterAllowedEffects } from "./effectsAllowlist.js";
import type { BehaviourContext, EffectName, SpeechBubbleContent } from "./types.js";

const INK = "#1b1d23";

function Zzz({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(78,-4)"
      animate={animate ? { y: [0, -8], opacity: [0, 1, 0] } : undefined}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
    >
      <text x={0} y={18} fontSize={10} fill="#898781" fontWeight={700}>z</text>
      <text x={7} y={10} fontSize={13} fill="#898781" fontWeight={700}>z</text>
      <text x={16} y={0} fontSize={16} fill="#898781" fontWeight={700}>Z</text>
    </motion.g>
  );
}

function Sweat({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(46,24) scale(1.1)"
      animate={animate ? { y: [0, 6, 0], opacity: [0.7, 1, 0.7] } : undefined}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M0 0 C 6 8 6 14 0 14 C -6 14 -6 8 0 0 Z" fill="#6fb8f0" stroke="#fff" strokeWidth={0.5} />
    </motion.g>
  );
}

function ThoughtBubble({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(84,-10)"
      animate={animate ? { opacity: [0.6, 1, 0.6] } : undefined}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx={2} cy={16} r={2.5} fill="#fff" stroke={INK} strokeWidth={1} />
      <circle cx={8} cy={9} r={3.5} fill="#fff" stroke={INK} strokeWidth={1} />
      <ellipse cx={18} cy={0} rx={14} ry={10} fill="#fff" stroke={INK} strokeWidth={1} />
      <text x={18} y={4} textAnchor="middle" fontSize={9} fill={INK} fontWeight={700}>···</text>
    </motion.g>
  );
}

function SpeechBubble({ animate, content }: { animate: boolean; content: SpeechBubbleContent }) {
  return (
    <motion.g
      transform="translate(80,-14)"
      animate={animate ? { scale: [1, 1.08, 1] } : undefined}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "12px 10px" }}
    >
      <path d="M0 0 h24 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-14 l-6 6 v-6 h-4 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 Z" fill="#eda100" stroke="#fff" strokeWidth={1} />
      <text x={12} y={10} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>?</text>
      {content.optionCount > 0 && (
        <g transform="translate(26,-4)">
          <circle r={6} fill={INK} />
          <text y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">{content.optionCount}</text>
        </g>
      )}
    </motion.g>
  );
}

function Steam({ animate }: { animate: boolean }) {
  return (
    <g transform="translate(78,-8)">
      <motion.g
        animate={animate ? { y: [0, -6, 0], opacity: [0.5, 0.9, 0.5] } : undefined}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <circle cx={6} cy={10} r={6} fill="#9a9a96" />
        <circle cx={14} cy={4} r={5} fill="#9a9a96" />
        <circle cx={20} cy={10} r={4} fill="#9a9a96" />
        <circle cx={10} cy={-2} r={3} fill="#9a9a96" />
      </motion.g>
    </g>
  );
}

function DizzyStars({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(88,-2)"
      animate={animate ? { rotate: [0, 360] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "0px 0px" }}
    >
      <text x={-10} y={0} fontSize={12} fill="#eda100">✦</text>
      <text x={8} y={-6} fontSize={9} fill="#eda100">✦</text>
    </motion.g>
  );
}

function Sparkles({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(86,4)"
      animate={animate ? { scale: [0.6, 1.3, 0.6], opacity: [0.4, 1, 0.4] } : undefined}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <text x={0} y={0} fontSize={14} fill="#f5c842">✦</text>
      <text x={-12} y={10} fontSize={9} fill="#f5c842">✦</text>
      <text x={10} y={14} fontSize={10} fill="#f5c842">✦</text>
    </motion.g>
  );
}

function Lightbulb({ animate }: { animate: boolean }) {
  return (
    <motion.g
      transform="translate(84,-10)"
      animate={animate ? { opacity: [0.5, 1, 0.5] } : undefined}
      transition={{ duration: 1.2, repeat: Infinity }}
    >
      <circle cx={0} cy={0} r={8} fill="#f5c842" stroke={INK} strokeWidth={1} />
      <rect x={-3} y={7} width={6} height={4} fill="#888" />
    </motion.g>
  );
}

const RENDERERS: Record<Exclude<EffectName, "speech-bubble">, (animate: boolean) => JSX.Element> = {
  zzz: (a) => <Zzz animate={a} />,
  sweat: (a) => <Sweat animate={a} />,
  "thought-bubble": (a) => <ThoughtBubble animate={a} />,
  steam: (a) => <Steam animate={a} />,
  "dizzy-stars": (a) => <DizzyStars animate={a} />,
  sparkles: (a) => <Sparkles animate={a} />,
  lightbulb: (a) => <Lightbulb animate={a} />
};

/**
 * Renders the requested effects — but ONLY the ones `isEffectAllowed`
 * actually permits for this context. This is the enforcement point: a bad
 * `behaviourFor` mapping or a stray caller can't put Zzz on an awake
 * character, because this component silently drops anything not allowed
 * rather than trusting the caller.
 */
export function Effects({
  effects,
  speechBubble,
  ctx,
  reducedMotion
}: {
  effects: EffectName[];
  speechBubble: SpeechBubbleContent | null;
  ctx: BehaviourContext;
  reducedMotion: boolean;
}) {
  const allowed = filterAllowedEffects(effects, ctx);
  const animate = !reducedMotion;

  return (
    <>
      {allowed.map((effect) => (
        <g key={effect}>{RENDERERS[effect as Exclude<EffectName, "speech-bubble">]?.(animate)}</g>
      ))}
      {speechBubble && isSpeechBubbleAllowed(ctx) && <SpeechBubble animate={animate} content={speechBubble} />}
    </>
  );
}

function isSpeechBubbleAllowed(ctx: BehaviourContext): boolean {
  return ctx.state === "needs_input";
}
