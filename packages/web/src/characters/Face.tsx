import type { Mood } from "@agent-workshop/shared";
import type { FaceFeatures } from "./faceFeatures.js";

const INK = "#1b1d23";

const EYE_RADII: Record<FaceFeatures["eyeShape"], { rx: number; ry: number }> = {
  round: { rx: 9, ry: 9 },
  oval: { rx: 10, ry: 7 },
  narrow: { rx: 9, ry: 5 }
};

function BaseEyes({ shape }: { shape: FaceFeatures["eyeShape"] }) {
  const { rx, ry } = EYE_RADII[shape];
  return (
    <>
      <ellipse cx={42} cy={58} rx={rx} ry={ry} fill="#fff" />
      <ellipse cx={66} cy={58} rx={rx} ry={ry} fill="#fff" />
      <circle cx={42} cy={58} r={4} fill={INK} />
      <circle cx={66} cy={58} r={4} fill={INK} />
      {/* Eyelids — blink every ~4s */}
      <ellipse cx={42} cy={58} rx={rx + 1} ry={ry + 1} className="eyelid" />
      <ellipse cx={66} cy={58} rx={rx + 1} ry={ry + 1} className="eyelid" />
    </>
  );
}

function ClosedCurveEyes({ direction }: { direction: "down" | "up" }) {
  const d = direction === "down" ? "q6 5 12 0" : "q6 -5 12 0";
  return (
    <>
      <path d={`M36 58 ${d}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={`M60 58 ${d}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  );
}

function SpiralEyes() {
  return (
    <>
      <path d="M34 54 l10 10 M44 54 l-10 10" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M58 54 l10 10 M68 54 l-10 10" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

function Eyebrows({ style, mood }: { style: FaceFeatures["eyebrowStyle"]; mood: Mood }) {
  if (mood === "sleepy" || mood === "dizzy" || mood === "proud") return null;

  const raised = mood === "worried" || mood === "excited";
  const angledDown = mood === "frustrated";
  const baseY = raised ? 40 : angledDown ? 48 : 44;
  const thickness = style === "bushy" ? 3.5 : 2.5;
  const curve = style === "angled" || angledDown ? 6 : style === "bushy" ? 3 : 1;
  const tilt = angledDown ? -1 : 1;

  return (
    <>
      <path
        d={`M32 ${baseY + curve * tilt} q9 ${-curve * tilt} 18 0`}
        stroke={INK}
        strokeWidth={thickness}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M56 ${baseY} q9 ${-curve * tilt} 18 ${curve * tilt}`}
        stroke={INK}
        strokeWidth={thickness}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "worried":
      return <path d="M46 80 q4 -4 8 0 q4 4 8 0 q4 -4 8 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    case "frustrated":
      return <path d="M46 84 q8 -8 16 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    case "dizzy":
      return <circle cx={54} cy={80} r={3} fill="none" stroke={INK} strokeWidth={2} />;
    case "excited":
      return <ellipse cx={54} cy={80} rx={6} ry={5} fill={INK} opacity={0.85} />;
    case "proud":
      return <path d="M44 76 q10 8 20 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    case "sleepy":
      return <line x1={48} y1={80} x2={60} y2={80} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
    case "concentrating":
      return <line x1={47} y1={79} x2={61} y2={79} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
    case "focused":
      return <path d="M46 78 q8 5 16 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    default:
      return <line x1={48} y1={79} x2={60} y2={79} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
  }
}

function Nose({ shape }: { shape: FaceFeatures["nose"] }) {
  if (shape === "dot") return <circle cx={54} cy={68} r={2} fill={INK} opacity={0.5} />;
  if (shape === "line") return <line x1={54} y1={63} x2={54} y2={70} stroke={INK} strokeWidth={2} opacity={0.5} strokeLinecap="round" />;
  return <path d="M51 63 L57 63 L54 70 Z" fill={INK} opacity={0.4} />;
}

function CheekMarks({ kind }: { kind: FaceFeatures["cheekMarks"] }) {
  if (kind === "none") return null;
  const dots =
    kind === "twoDots"
      ? [
          [34, 68],
          [74, 68]
        ]
      : [
          [32, 66],
          [36, 70],
          [72, 68]
        ];
  return (
    <>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.6} fill={INK} opacity={0.35} />
      ))}
    </>
  );
}

function HairTuft({ kind }: { kind: FaceFeatures["hairTuft"] }) {
  if (kind === "none") return null;
  if (kind === "curl") return <path d="M50 24 q4 -10 10 -4 q2 6 -6 6" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
  if (kind === "spikes") {
    return (
      <>
        <path d="M44 26 l-3 -10" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        <path d="M54 24 l0 -11" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        <path d="M64 26 l3 -10" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </>
    );
  }
  return <path d="M40 28 q10 -16 24 -6" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
}

export function Face({ features, mood }: { features: FaceFeatures; mood: Mood }) {
  return (
    <>
      <HairTuft kind={features.hairTuft} />
      {mood === "sleepy" && <ClosedCurveEyes direction="down" />}
      {mood === "proud" && <ClosedCurveEyes direction="up" />}
      {mood === "dizzy" || mood === "frustrated" ? <SpiralEyes /> : null}
      {mood !== "sleepy" && mood !== "proud" && mood !== "dizzy" && mood !== "frustrated" && <BaseEyes shape={features.eyeShape} />}
      <Eyebrows style={features.eyebrowStyle} mood={mood} />
      <Nose shape={features.nose} />
      <Mouth mood={mood} />
      <CheekMarks kind={features.cheekMarks} />
    </>
  );
}
