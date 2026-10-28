const STORAGE_KEY = "mimir:user-avatar:v1";

export type SkinTone = "#f5d0b0" | "#e8b88a" | "#c68c53" | "#8d5e3c" | "#4a2f1a";
export type HairStyle = "short" | "long" | "curly" | "bald";
export type HairColor = "#1a1a1a" | "#4a3520" | "#b8860b" | "#c04020";
export type ShirtColor = "#3355aa" | "#cc4444" | "#2a8a4a" | "#8844aa" | "#e08020";
export type Gender = "male" | "female";
export type Expression = "smile" | "grin" | "neutral" | "focused";

export interface AvatarConfig {
  gender: Gender;
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  glasses: boolean;
  shirtColor: ShirtColor;
  expression: Expression;
}

export const GENDERS: Gender[] = ["male", "female"];
export const SKIN_TONES: SkinTone[] = ["#f5d0b0", "#e8b88a", "#c68c53", "#8d5e3c", "#4a2f1a"];
export const HAIR_STYLES: HairStyle[] = ["short", "long", "curly", "bald"];
export const HAIR_COLORS: HairColor[] = ["#1a1a1a", "#4a3520", "#b8860b", "#c04020"];
export const SHIRT_COLORS: ShirtColor[] = ["#3355aa", "#cc4444", "#2a8a4a", "#8844aa", "#e08020"];
export const EXPRESSIONS: Expression[] = ["smile", "grin", "neutral", "focused"];

export const DEFAULT_AVATAR: AvatarConfig = {
  gender: "male",
  skinTone: "#f5d0b0",
  hairStyle: "short",
  hairColor: "#4a3520",
  glasses: false,
  shirtColor: "#cc4444",
  expression: "smile"
};

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_AVATAR, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_AVATAR;
}

export function saveAvatar(config: AvatarConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}
