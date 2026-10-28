import { hashString, MAIN_AGENT_ID } from "@agent-workshop/shared";

export type Role = "foreman" | "explore" | "plan" | "general-purpose" | "unknown";
export type UnknownAccessory = "headband" | "bandana" | "beanie" | "visor";
export type EyeShape = "round" | "oval" | "narrow";
export type EyebrowStyle = "straight" | "angled" | "bushy";
export type Nose = "dot" | "line" | "triangle";
export type HairTuft = "none" | "curl" | "spikes" | "sideSwept";
export type CheekMarks = "none" | "twoDots" | "threeDots";

export interface FaceFeatures {
  role: Role;
  /** Only set when role === "unknown" — a custom/unrecognized agent type
   *  gets one consistent fallback accessory per type name, not per instance. */
  unknownAccessory: UnknownAccessory | null;
  eyeShape: EyeShape;
  eyebrowStyle: EyebrowStyle;
  nose: Nose;
  hairTuft: HairTuft;
  cheekMarks: CheekMarks;
}

const UNKNOWN_ACCESSORIES: readonly UnknownAccessory[] = ["headband", "bandana", "beanie", "visor"];
const EYE_SHAPES: readonly EyeShape[] = ["round", "oval", "narrow"];
const EYEBROW_STYLES: readonly EyebrowStyle[] = ["straight", "angled", "bushy"];
const NOSES: readonly Nose[] = ["dot", "line", "triangle"];
const HAIR_TUFTS: readonly HairTuft[] = ["none", "curl", "spikes", "sideSwept"];
const CHEEK_MARKS: readonly CheekMarks[] = ["none", "twoDots", "threeDots"];

function pick<T>(seed: string, salt: string, options: readonly T[]): T {
  return options[hashString(`${seed}:${salt}`) % options.length];
}

export function roleFor(agentId: string, agentType: string | null): Role {
  if (agentId === MAIN_AGENT_ID) return "foreman";
  switch (agentType) {
    case "Explore":
      return "explore";
    case "Plan":
      return "plan";
    case "general-purpose":
      return "general-purpose";
    default:
      return "unknown";
  }
}

/**
 * Deterministic per-agent face: role (hard hat/goggles/glasses/cap/hashed
 * fallback) picks the primary identifying accessory; every other trait is
 * seeded off the agent id so the same agent always looks the same, and
 * different agents are very likely to differ in at least one trait. Mood
 * (see mood.ts) drives the *expression* on top of this fixed face — this
 * module never changes based on lifecycle or activity.
 */
export function deriveFaceFeatures(agentId: string, agentType: string | null): FaceFeatures {
  const role = roleFor(agentId, agentType);
  return {
    role,
    unknownAccessory: role === "unknown" ? pick(agentType ?? "unknown", "accessory", UNKNOWN_ACCESSORIES) : null,
    eyeShape: pick(agentId, "eye", EYE_SHAPES),
    eyebrowStyle: pick(agentId, "brow", EYEBROW_STYLES),
    nose: pick(agentId, "nose", NOSES),
    hairTuft: pick(agentId, "hair", HAIR_TUFTS),
    cheekMarks: pick(agentId, "cheek", CHEEK_MARKS)
  };
}
