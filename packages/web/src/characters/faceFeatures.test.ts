import { describe, expect, it } from "vitest";
import { MAIN_AGENT_ID } from "@agent-workshop/shared";
import { deriveFaceFeatures, roleFor, roleLabel } from "./faceFeatures.js";

describe("roleFor", () => {
  it("maps the main agent to foreman regardless of agentType", () => {
    expect(roleFor(MAIN_AGENT_ID, null)).toBe("foreman");
    expect(roleFor(MAIN_AGENT_ID, "whatever")).toBe("foreman");
  });

  it("maps known subagent types to their role", () => {
    expect(roleFor("agent-1", "Explore")).toBe("explore");
    expect(roleFor("agent-1", "Plan")).toBe("plan");
    expect(roleFor("agent-1", "general-purpose")).toBe("general-purpose");
  });

  it("maps unrecognized types to unknown", () => {
    expect(roleFor("agent-1", "security-reviewer")).toBe("unknown");
    expect(roleFor("agent-1", null)).toBe("unknown");
  });
});

describe("roleLabel", () => {
  it("shows the known agent type for recognized roles", () => {
    expect(roleLabel(MAIN_AGENT_ID, null)).toBe("Foreman");
    expect(roleLabel("agent-1", "Explore")).toBe("Explore");
    expect(roleLabel("agent-1", "general-purpose")).toBe("general-purpose");
  });

  it("shows a custom agent type verbatim when it's known", () => {
    expect(roleLabel("agent-1", "security-reviewer")).toBe("security-reviewer");
  });

  it("falls back to 'subagent' for a null agentType, never an empty string", () => {
    expect(roleLabel("agent-1", null)).toBe("subagent");
  });

  // Regression: a real Task call without an explicit subagent_type can send
  // agent_type as "" rather than omitting it. `agentType ?? "fallback"`
  // doesn't catch that (?? only triggers on null/undefined), which produced
  // name tags like "Juno ·" with nothing after the dot.
  it("falls back to 'subagent' for an empty-string agentType, never an empty string", () => {
    expect(roleLabel("agent-1", "")).toBe("subagent");
  });

  it("falls back to 'subagent' for a whitespace-only agentType", () => {
    expect(roleLabel("agent-1", "   ")).toBe("subagent");
  });
});

describe("deriveFaceFeatures", () => {
  it("is deterministic for the same agent id and type", () => {
    const a = deriveFaceFeatures("agent-1", "Explore");
    const b = deriveFaceFeatures("agent-1", "Explore");
    expect(a).toEqual(b);
  });

  it("gives every custom-type instance of the same type the same fallback accessory", () => {
    const a = deriveFaceFeatures("agent-1", "security-reviewer");
    const b = deriveFaceFeatures("agent-99", "security-reviewer");
    expect(a.unknownAccessory).toBe(b.unknownAccessory);
    expect(a.unknownAccessory).not.toBeNull();
  });

  it("leaves unknownAccessory null for recognized roles", () => {
    expect(deriveFaceFeatures(MAIN_AGENT_ID, null).unknownAccessory).toBeNull();
    expect(deriveFaceFeatures("agent-1", "Explore").unknownAccessory).toBeNull();
  });

  it("different agent ids are very likely to differ in at least one seeded trait", () => {
    const ids = ["agent-1", "agent-2", "agent-3", "agent-4", "agent-5"];
    const faces = ids.map((id) => deriveFaceFeatures(id, "general-purpose"));
    const signatures = new Set(faces.map((f) => `${f.eyeShape}|${f.eyebrowStyle}|${f.nose}|${f.hairTuft}|${f.cheekMarks}`));
    expect(signatures.size).toBeGreaterThan(1);
  });
});
