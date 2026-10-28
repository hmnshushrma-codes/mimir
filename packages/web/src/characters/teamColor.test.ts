import { describe, expect, it } from "vitest";
import { CHARACTER_PALETTE } from "./palette.js";
import { TeamColorAssigner, type StorageLike } from "./teamColor.js";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value)
  };
}

describe("TeamColorAssigner", () => {
  it("assigns colors in order of first appearance", () => {
    const assigner = new TeamColorAssigner(memoryStorage());
    expect(assigner.colorFor("s1").colorIndex).toBe(0);
    expect(assigner.colorFor("s2").colorIndex).toBe(1);
    expect(assigner.colorFor("s3").colorIndex).toBe(2);
  });

  it("is stable for the same session id", () => {
    const assigner = new TeamColorAssigner(memoryStorage());
    const first = assigner.colorFor("s1");
    assigner.colorFor("s2");
    assigner.colorFor("s3");
    expect(assigner.colorFor("s1")).toEqual(first);
  });

  it("persists across a fresh assigner instance using the same storage", () => {
    const storage = memoryStorage();
    const first = new TeamColorAssigner(storage);
    const colorBefore = first.colorFor("s1");

    const second = new TeamColorAssigner(storage);
    expect(second.colorFor("s1")).toEqual(colorBefore);
  });

  it("wraps around and marks the first wrap-around cycle with stripes", () => {
    const assigner = new TeamColorAssigner(memoryStorage());
    for (let i = 0; i < CHARACTER_PALETTE.length; i++) {
      assigner.colorFor(`s${i}`);
    }
    const wrapped = assigner.colorFor("wrap-1");
    expect(wrapped.colorIndex).toBe(0);
    expect(wrapped.pattern).toBe("stripes");
  });

  it("marks the second wrap-around cycle with dots", () => {
    const assigner = new TeamColorAssigner(memoryStorage());
    for (let i = 0; i < CHARACTER_PALETTE.length * 2; i++) {
      assigner.colorFor(`s${i}`);
    }
    const wrapped = assigner.colorFor("wrap-2");
    expect(wrapped.colorIndex).toBe(0);
    expect(wrapped.pattern).toBe("dots");
  });

  it("falls back to in-memory assignment when storage throws", () => {
    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      }
    };
    const assigner = new TeamColorAssigner(throwingStorage);
    expect(() => assigner.colorFor("s1")).not.toThrow();
    expect(assigner.colorFor("s1").colorIndex).toBe(0);
  });
});
