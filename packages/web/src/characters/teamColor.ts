import { CHARACTER_PALETTE } from "./palette.js";

const STORAGE_KEY = "agent-workshop:team-colors:v1";

export type HatPattern = "none" | "stripes" | "dots";

export interface TeamColor {
  colorIndex: number;
  pattern: HatPattern;
}

interface ColorAssignment {
  index: number;
  cycle: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Assigns each session a team color from the validated categorical palette,
 * in order of first appearance, persisted so a page reload doesn't reshuffle
 * colors. Once every palette slot has been used once (a "cycle"), later
 * sessions reuse colors but escalate the hat pattern (stripes, then dots) so
 * two same-colored teams are still visually distinguishable.
 */
export class TeamColorAssigner {
  private cache: Record<string, ColorAssignment> | null = null;

  constructor(private readonly storage: StorageLike | null = safeStorage()) {}

  private load(): Record<string, ColorAssignment> {
    if (this.cache) return this.cache;
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      this.cache = raw ? (JSON.parse(raw) as Record<string, ColorAssignment>) : {};
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private save(): void {
    if (!this.cache) return;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // storage unavailable or full — in-memory assignment for this run still works
    }
  }

  colorFor(sessionId: string): TeamColor {
    const assignments = this.load();
    let entry = assignments[sessionId];
    if (!entry) {
      const assignedCount = Object.keys(assignments).length;
      entry = {
        index: assignedCount % CHARACTER_PALETTE.length,
        cycle: Math.floor(assignedCount / CHARACTER_PALETTE.length)
      };
      assignments[sessionId] = entry;
      this.save();
    }

    const pattern: HatPattern = entry.cycle === 0 ? "none" : entry.cycle % 2 === 1 ? "stripes" : "dots";
    return { colorIndex: entry.index, pattern };
  }
}

export const teamColorAssigner = new TeamColorAssigner();

export function teamColorFor(sessionId: string): TeamColor {
  return teamColorAssigner.colorFor(sessionId);
}
