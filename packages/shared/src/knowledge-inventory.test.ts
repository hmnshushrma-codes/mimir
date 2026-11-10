import { describe, expect, it, beforeEach } from "vitest";
import { buildKnowledgeInventory, detectUserCorrections, resetKnowledgeIds } from "./knowledge-inventory.js";
import type { ToolCallAnalytics } from "./analytics.js";
import { WorkshopModel } from "./model.js";
import { buildToolCallAnalytics } from "./analytics-builders.js";

function tc(overrides: Partial<ToolCallAnalytics>): ToolCallAnalytics {
  return {
    toolUseId: "tu-" + Math.random().toString(36).slice(2, 6),
    sessionId: "s1", agentId: "main", toolName: "Read", category: "read",
    status: "succeeded", target: "src/app.ts",
    startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:00:01Z",
    durationMs: 1000, isRetry: false,
    ...overrides,
  };
}

beforeEach(() => resetKnowledgeIds());

describe("buildKnowledgeInventory", () => {
  it("detects CLAUDE.md as project instructions", () => {
    const calls = [tc({ target: "CLAUDE.md" })];
    const items = buildKnowledgeInventory(calls);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe("claude_md");
    expect(items[0].description).toContain("Project instructions");
  });

  it("detects .claude/ paths as project instructions", () => {
    const calls = [tc({ target: ".claude/settings.json" })];
    const items = buildKnowledgeInventory(calls);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe("project_instructions");
  });

  it("detects frequently accessed files (3+ reads)", () => {
    const calls = [
      tc({ target: "src/utils.ts", startedAt: "2026-01-01T00:00:00Z" }),
      tc({ target: "src/utils.ts", startedAt: "2026-01-01T00:01:00Z" }),
      tc({ target: "src/utils.ts", startedAt: "2026-01-01T00:02:00Z" }),
    ];
    const items = buildKnowledgeInventory(calls);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe("frequently_accessed_file");
    expect(items[0].accessCount).toBe(3);
  });

  it("does not flag files accessed only 1-2 times", () => {
    const calls = [
      tc({ target: "src/once.ts" }),
      tc({ target: "src/twice.ts" }),
      tc({ target: "src/twice.ts" }),
    ];
    const items = buildKnowledgeInventory(calls);
    expect(items.length).toBe(0);
  });

  it("sorts by access count (most accessed first)", () => {
    const calls = [
      ...Array.from({ length: 3 }, () => tc({ target: "src/low.ts" })),
      ...Array.from({ length: 5 }, () => tc({ target: "src/high.ts" })),
    ];
    const items = buildKnowledgeInventory(calls);
    expect(items[0].path).toBe("src/high.ts");
    expect(items[0].accessCount).toBe(5);
  });

  it("always includes CLAUDE.md even with 1 access", () => {
    const calls = [tc({ target: "CLAUDE.md" })];
    const items = buildKnowledgeInventory(calls);
    expect(items.length).toBe(1);
  });
});

describe("detectUserCorrections", () => {
  it("detects edit after failed read on same file", () => {
    const calls = [
      tc({ toolUseId: "f1", toolName: "Write", category: "write", status: "failed", target: "src/fix.ts", startedAt: "2026-01-01T00:00:00Z" }),
      tc({ toolUseId: "e1", toolName: "Edit", category: "write", status: "succeeded", target: "src/fix.ts", startedAt: "2026-01-01T00:00:05Z" }),
    ];
    const corrections = detectUserCorrections(calls);
    expect(corrections.length).toBe(1);
    expect(corrections[0].type).toBe("user_correction");
    expect(corrections[0].path).toBe("src/fix.ts");
  });

  it("does not flag unrelated edits", () => {
    const calls = [
      tc({ toolUseId: "f1", toolName: "Write", status: "failed", target: "a.ts", startedAt: "2026-01-01T00:00:00Z" }),
      tc({ toolUseId: "e1", toolName: "Edit", status: "succeeded", target: "b.ts", startedAt: "2026-01-01T00:00:05Z" }),
    ];
    const corrections = detectUserCorrections(calls);
    expect(corrections.length).toBe(0);
  });
});

describe("integration — knowledge from real model events", () => {
  it("builds inventory from a session with repeated reads", () => {
    const model = new WorkshopModel();
    const T = "2026-01-15T10:00:00.000Z";
    const ts = (ms: number) => new Date(Date.parse(T) + ms).toISOString();

    model.ingest({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", timestamp: ts(0) });
    // Read CLAUDE.md once
    model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "CLAUDE.md" }, tool_use_id: "c1", timestamp: ts(100) });
    model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "c1", timestamp: ts(200) });
    // Read src/auth.ts 4 times
    for (let i = 0; i < 4; i++) {
      model.ingest({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/auth.ts" }, tool_use_id: `r${i}`, timestamp: ts(1000 + i * 500) });
      model.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: `r${i}`, timestamp: ts(1200 + i * 500) });
    }

    const session = model.getSession("s1")!;
    const toolCalls = buildToolCallAnalytics(session);
    const inventory = buildKnowledgeInventory(toolCalls);

    // CLAUDE.md (1 access) + src/auth.ts (4 accesses)
    expect(inventory.length).toBe(2);
    expect(inventory[0].path).toBe("src/auth.ts"); // 4 accesses — sorted first
    expect(inventory[0].accessCount).toBe(4);
    expect(inventory[1].path).toBe("CLAUDE.md");
    expect(inventory[1].type).toBe("claude_md");
  });
});
