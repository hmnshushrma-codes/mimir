/**
 * Placeholder — the contract suite lives in store-contract.ts
 * and is run by each store implementation's own test file.
 * This file just verifies the types compile.
 */
import { describe, it, expect } from "vitest";
import type { WorkStore, SessionLink, ReportSnapshot } from "./store.js";

describe("WorkStore types", () => {
  it("SessionLink type has required fields", () => {
    const link: SessionLink = { sessionId: "s1", workItemId: "w1", matchMethod: "branch", linkedAt: "2026-01-01" };
    expect(link.sessionId).toBe("s1");
  });

  it("ReportSnapshot type has required fields", () => {
    const snap: ReportSnapshot = { id: "r1", period: "day", anchor: "2026-01-01", connectionId: null, data: "{}", computedAt: "2026-01-01" };
    expect(snap.period).toBe("day");
  });
});
