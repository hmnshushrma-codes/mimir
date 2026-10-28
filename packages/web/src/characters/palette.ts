import { hashString } from "@agent-workshop/shared";

// Validated categorical palette (8 hues, CVD-checked), ordered so that
// consecutive entries are maximally distinct — no two adjacent colours
// share a hue family. This matters because sessions are assigned in order
// of first appearance, and adjacent sessions often sit next to each other
// in the desk grid.
export const CHARACTER_PALETTE: Array<{ light: string; dark: string }> = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e34948", dark: "#e66767" }, // red
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" } // green
];

export { hashString };

export function colorIndexFor(seed: string): number {
  return hashString(seed) % CHARACTER_PALETTE.length;
}
