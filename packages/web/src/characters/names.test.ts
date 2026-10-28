import { describe, expect, it } from "vitest";
import { nameFor, workerLabel } from "./names.js";

describe("nameFor", () => {
  it("is deterministic for the same agent id", () => {
    expect(nameFor("agent-1")).toBe(nameFor("agent-1"));
  });
});

describe("workerLabel", () => {
  it("formats as 'Worker #N · Name'", () => {
    const label = workerLabel("agent-1", 3);
    expect(label).toBe(`Worker #3 · ${nameFor("agent-1")}`);
  });
});
