import { describe, expect, it } from "vitest";
import { CHARACTER_PALETTE, colorIndexFor, hashString } from "./palette.js";
import { contrastCapColor } from "./colorUtils.js";

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("agent-1")).toBe(hashString("agent-1"));
  });

  it("differs for different inputs (no trivial collisions for these ids)", () => {
    expect(hashString("agent-1")).not.toBe(hashString("agent-2"));
  });
});

describe("colorIndexFor", () => {
  it("always returns a valid palette index", () => {
    for (const id of ["main", "agent-1", "agent-2", "agent-3", "a-very-long-agent-id-string"]) {
      const index = colorIndexFor(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(CHARACTER_PALETTE.length);
    }
  });

  it("is deterministic — same agent id always gets the same color", () => {
    expect(colorIndexFor("agent-1")).toBe(colorIndexFor("agent-1"));
  });
});

describe("palette distinctness", () => {
  it("no two adjacent palette entries share the same light hex", () => {
    for (let i = 0; i < CHARACTER_PALETTE.length - 1; i++) {
      expect(CHARACTER_PALETTE[i].light).not.toBe(CHARACTER_PALETTE[i + 1].light);
    }
  });

  it("cap color differs for at least some team colours (light vs dark cap)", () => {
    const caps = new Set(CHARACTER_PALETTE.map((p) => contrastCapColor(p.light)));
    expect(caps.size).toBeGreaterThanOrEqual(2);
  });
});
