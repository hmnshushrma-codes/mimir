function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function channelToHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

/** Blends a hex color toward white by `amount` (0 = unchanged, 1 = white) —
 *  used to give subagents a lighter shade of their team's color. */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = r + (255 - r) * amount;
  const ng = g + (255 - g) * amount;
  const nb = b + (255 - b) * amount;
  return `#${channelToHex(nr)}${channelToHex(ng)}${channelToHex(nb)}`;
}

/** Relative luminance per WCAG 2.x (0 = black, 1 = white). */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns a baseball-cap color that contrasts well with the given body fill.
 *  Light bodies get a dark cap; dark bodies get a light cap — both with enough
 *  contrast to read clearly at small sizes. */
export function contrastCapColor(bodyFill: string): string {
  return luminance(bodyFill) > 0.25 ? "#1b1d23" : "#f0f0f0";
}
