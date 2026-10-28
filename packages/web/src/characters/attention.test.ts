import { describe, expect, it } from "vitest";
import { sortByAttention, worstMoodRank } from "./attention.js";

describe("worstMoodRank", () => {
  it("worried outranks everything", () => {
    expect(worstMoodRank(["focused", "worried", "sleepy"])).toBeLessThan(worstMoodRank(["focused", "sleepy"]));
  });

  it("error moods outrank working moods", () => {
    expect(worstMoodRank(["dizzy"])).toBeLessThan(worstMoodRank(["focused"]));
    expect(worstMoodRank(["frustrated"])).toBeLessThan(worstMoodRank(["concentrating"]));
  });

  it("working moods outrank idle", () => {
    expect(worstMoodRank(["focused"])).toBeLessThan(worstMoodRank(["sleepy"]));
  });

  it("an empty list ranks lowest (least urgent)", () => {
    expect(worstMoodRank([])).toBeGreaterThan(worstMoodRank(["sleepy"]));
  });
});

describe("sortByAttention", () => {
  it("orders waiting_permission -> error -> working -> idle", () => {
    const sessions = [
      { id: "idle-session", moods: ["sleepy" as const] },
      { id: "worried-session", moods: ["sleepy" as const, "worried" as const] },
      { id: "working-session", moods: ["focused" as const] },
      { id: "error-session", moods: ["dizzy" as const] }
    ];
    const sorted = sortByAttention(sessions, (s) => s.moods);
    expect(sorted.map((s) => s.id)).toEqual(["worried-session", "error-session", "working-session", "idle-session"]);
  });

  it("does not mutate the input array", () => {
    const sessions = [{ id: "a", moods: ["sleepy" as const] }, { id: "b", moods: ["worried" as const] }];
    const copy = [...sessions];
    sortByAttention(sessions, (s) => s.moods);
    expect(sessions).toEqual(copy);
  });
});
