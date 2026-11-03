import { describe, expect, it } from "vitest";
import { classifyAgentVisibility, countVisibleAgents, FINISHED_SHELF_WINDOW_MS } from "./agentVisibility.js";

function agentWith(leaving: boolean, updatedAt: string) {
  return { state: { needsPermission: false, awaitingPrompt: false, done: false, leaving, lastError: null, updatedAt } } as never;
}

const NOW = Date.parse("2026-01-01T00:02:00.000Z");

describe("classifyAgentVisibility", () => {
  it("is always active while not leaving", () => {
    expect(classifyAgentVisibility(agentWith(false, "2026-01-01T00:01:59.000Z"), NOW)).toBe("active");
  });

  it("is finished for a short time after reaching 'leaving'", () => {
    const justLeft = agentWith(true, new Date(NOW - 1_000).toISOString());
    expect(classifyAgentVisibility(justLeft, NOW)).toBe("finished");
  });

  it("is hidden once the finished window has elapsed", () => {
    const longGone = agentWith(true, new Date(NOW - FINISHED_SHELF_WINDOW_MS - 1_000).toISOString());
    expect(classifyAgentVisibility(longGone, NOW)).toBe("hidden");
  });

  it("respects a custom window", () => {
    const left5sAgo = agentWith(true, new Date(NOW - 5_000).toISOString());
    expect(classifyAgentVisibility(left5sAgo, NOW, 10_000)).toBe("finished");
    expect(classifyAgentVisibility(left5sAgo, NOW, 1_000)).toBe("hidden");
  });
});

describe("countVisibleAgents", () => {
  it("regression: counts match what's actually shown — active + finished, never the raw historical total", () => {
    const agents = [
      agentWith(false, "2026-01-01T00:01:59.000Z"), // foreman, active
      agentWith(true, new Date(NOW - FINISHED_SHELF_WINDOW_MS - 1_000).toISOString()) // long gone, hidden
    ];
    // The bug: a naive `agents.length` here would say "2 agents" while only
    // one is actually rendered anywhere (grid or finished shelf).
    expect(agents.length).toBe(2);
    expect(countVisibleAgents(agents, NOW)).toBe(1);
  });

  it("includes agents still fading in the finished shelf", () => {
    const agents = [agentWith(false, "2026-01-01T00:01:59.000Z"), agentWith(true, new Date(NOW - 1_000).toISOString())];
    expect(countVisibleAgents(agents, NOW)).toBe(2);
  });
});
