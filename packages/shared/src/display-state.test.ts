import { describe, expect, it } from "vitest";
import { deriveDisplayState, DEFAULT_DISPLAY_STATE_CONFIG, type DisplayStateContext } from "./display-state.js";

const NOW = "2026-01-01T00:10:00.000Z";

function ctx(overrides: Partial<DisplayStateContext> = {}): DisplayStateContext {
  return {
    needsPermission: false,
    openToolCalls: [],
    awaitingPrompt: false,
    done: false,
    consecutiveErrors: 0,
    lastError: null,
    lastEventAt: NOW,
    isForeman: false,
    hasActiveSubagents: false,
    nowIso: NOW,
    ...overrides
  };
}

function secondsAgo(s: number): string {
  return new Date(Date.parse(NOW) - s * 1000).toISOString();
}

describe("deriveDisplayState — one case per table row", () => {
  it("needs_permission", () => {
    expect(deriveDisplayState(ctx({ needsPermission: true })).state).toBe("needs_permission");
  });

  it("needs_input — open AskUserQuestion call", () => {
    const result = deriveDisplayState(
      ctx({ openToolCalls: [{ toolName: "AskUserQuestion", category: "other", startedAt: secondsAgo(5) }] })
    );
    expect(result.state).toBe("needs_input");
  });

  it("error — consecutive failures with no success since", () => {
    expect(deriveDisplayState(ctx({ consecutiveErrors: 1, lastError: "boom" })).state).toBe("error");
  });

  it("working — any open non-needs-input tool call, regardless of duration", () => {
    const result = deriveDisplayState(
      ctx({ openToolCalls: [{ toolName: "Bash", category: "shell", startedAt: secondsAgo(600) }] })
    );
    expect(result.state).toBe("working");
    expect(result.reason).toContain("Bash");
  });

  it("supervising — foreman with active subagents, no open call of its own", () => {
    expect(deriveDisplayState(ctx({ isForeman: true, hasActiveSubagents: true })).state).toBe("supervising");
  });

  it("thinking — no open call, not supervising, recent event", () => {
    expect(deriveDisplayState(ctx({ lastEventAt: secondsAgo(10) })).state).toBe("thinking");
  });

  it("stalled — same as thinking but past the threshold", () => {
    expect(deriveDisplayState(ctx({ lastEventAt: secondsAgo(91) })).state).toBe("stalled");
  });

  it("awaiting_prompt — foreman after Stop, within the sleep threshold", () => {
    const result = deriveDisplayState(ctx({ isForeman: true, awaitingPrompt: true, lastEventAt: secondsAgo(10) }));
    expect(result.state).toBe("awaiting_prompt");
  });

  it("sleeping — awaiting_prompt held past the sleep threshold", () => {
    const result = deriveDisplayState(ctx({ isForeman: true, awaitingPrompt: true, lastEventAt: secondsAgo(301) }));
    expect(result.state).toBe("sleeping");
  });

  it("done — subagent finished, no other condition applies", () => {
    expect(deriveDisplayState(ctx({ done: true, lastEventAt: secondsAgo(500) })).state).toBe("done");
  });
});

describe("defensive against unparseable timestamps", () => {
  it("an unparseable lastEventAt reads as 'just happened' (thinking), never stalled/sleeping", () => {
    expect(deriveDisplayState(ctx({ lastEventAt: "not-a-real-timestamp" })).state).toBe("thinking");
  });

  it("formatElapsed never leaks NaN into the reason string", () => {
    const result = deriveDisplayState(
      ctx({ openToolCalls: [{ toolName: "Bash", category: "shell", startedAt: "not-a-real-timestamp" }] })
    );
    expect(result.reason).not.toContain("NaN");
  });
});

describe("priority ordering", () => {
  it("needs_permission wins over everything else", () => {
    const result = deriveDisplayState(
      ctx({
        needsPermission: true,
        openToolCalls: [{ toolName: "Bash", category: "shell", startedAt: secondsAgo(1) }],
        consecutiveErrors: 5,
        isForeman: true,
        hasActiveSubagents: true
      })
    );
    expect(result.state).toBe("needs_permission");
  });

  it("needs_input wins over a plain open working call and over error", () => {
    const result = deriveDisplayState(
      ctx({
        openToolCalls: [
          { toolName: "Bash", category: "shell", startedAt: secondsAgo(2) },
          { toolName: "AskUserQuestion", category: "other", startedAt: secondsAgo(1) }
        ],
        consecutiveErrors: 2
      })
    );
    expect(result.state).toBe("needs_input");
  });

  it("working wins over supervising when the foreman also has its own open call", () => {
    const result = deriveDisplayState(
      ctx({
        isForeman: true,
        hasActiveSubagents: true,
        openToolCalls: [{ toolName: "Read", category: "read", startedAt: secondsAgo(1) }]
      })
    );
    expect(result.state).toBe("working");
  });

  it("supervising wins over thinking/stalled regardless of elapsed time", () => {
    const result = deriveDisplayState(ctx({ isForeman: true, hasActiveSubagents: true, lastEventAt: secondsAgo(9999) }));
    expect(result.state).toBe("supervising");
  });
});

describe("real measured tool-call gaps all resolve to thinking", () => {
  // Gaps measured live between PostToolUse and the next PreToolUse during
  // this project's own Part 0 audit — exactly the window that used to
  // render as "asleep" (Zzz) under the old lifecycle/mood system.
  for (const gapSeconds of [2.5, 3.1, 4.2, 7.1, 11.2]) {
    it(`${gapSeconds}s gap -> thinking`, () => {
      const lastEventAt = new Date(Date.parse(NOW) - gapSeconds * 1000).toISOString();
      expect(deriveDisplayState(ctx({ lastEventAt })).state).toBe("thinking");
    });
  }
});

describe("sleeping is structurally unreachable in the wrong conditions", () => {
  it("an agent with an open tool call can never be sleeping, no matter how stale awaitingPrompt/lastEventAt are", () => {
    const result = deriveDisplayState(
      ctx({
        isForeman: true,
        awaitingPrompt: true,
        lastEventAt: secondsAgo(99999),
        openToolCalls: [{ toolName: "Bash", category: "shell", startedAt: secondsAgo(1) }]
      })
    );
    expect(result.state).not.toBe("sleeping");
    expect(result.state).toBe("working");
  });

  it("an agent with running subagents can never be sleeping", () => {
    const result = deriveDisplayState(
      ctx({ isForeman: true, awaitingPrompt: true, hasActiveSubagents: true, lastEventAt: secondsAgo(99999) })
    );
    expect(result.state).not.toBe("sleeping");
    expect(result.state).toBe("supervising");
  });

  // "Subagents can never be sleeping at all" is NOT a property of this pure
  // function — it only renders whatever flags it's handed, and would happily
  // produce "sleeping" for isForeman:false if awaitingPrompt were somehow
  // true. The real guarantee is structural, one layer up: only the `Stop`
  // hook event sets awaitingPrompt (workshop-event.test.ts: "Stop ->
  // AWAIT_PROMPT"), and Stop never fires for a subagent (subagents get
  // SubagentStop -> DONE instead). See model.test.ts for the end-to-end
  // version of this guarantee, ingesting real events rather than hand-built
  // contexts.
});
