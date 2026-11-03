import { describe, expect, it } from "vitest";
import { sortByAttention, worstStateRank } from "./attention.js";

describe("worstStateRank", () => {
  it("needs_permission outranks everything", () => {
    expect(worstStateRank(["thinking", "needs_permission", "sleeping"])).toBeLessThan(
      worstStateRank(["thinking", "sleeping"])
    );
  });

  it("error outranks working", () => {
    expect(worstStateRank(["error"])).toBeLessThan(worstStateRank(["working"]));
  });

  it("working outranks idle states", () => {
    expect(worstStateRank(["working"])).toBeLessThan(worstStateRank(["sleeping"]));
  });

  it("an empty list ranks lowest (least urgent)", () => {
    expect(worstStateRank([])).toBeGreaterThan(worstStateRank(["sleeping"]));
  });
});

describe("sortByAttention", () => {
  it("orders needs_permission -> error -> working -> idle", () => {
    const sessions = [
      { id: "idle-session", states: ["sleeping" as const] },
      { id: "permission-session", states: ["sleeping" as const, "needs_permission" as const] },
      { id: "working-session", states: ["working" as const] },
      { id: "error-session", states: ["error" as const] }
    ];
    const sorted = sortByAttention(sessions, (s) => s.states);
    expect(sorted.map((s) => s.id)).toEqual([
      "permission-session",
      "error-session",
      "working-session",
      "idle-session"
    ]);
  });

  it("does not mutate the input array", () => {
    const sessions = [{ id: "a", states: ["sleeping" as const] }, { id: "b", states: ["needs_permission" as const] }];
    const copy = [...sessions];
    sortByAttention(sessions, (s) => s.states);
    expect(sessions).toEqual(copy);
  });
});
