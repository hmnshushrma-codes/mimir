import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import {
  createReaderState,
  readTranscriptIncremental,
  buildSummary,
  getContextLimit,
  readSubagentTranscripts,
} from "./transcript-reader.js";

function makeAssistantLine(requestId: string, inputTokens: number, outputTokens: number, cacheCreate = 0, cacheRead = 0, model = "claude-opus-4-6") {
  return JSON.stringify({
    type: "assistant",
    requestId,
    timestamp: "2026-01-15T10:00:00.000Z",
    message: {
      type: "message",
      model,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: cacheCreate,
        cache_read_input_tokens: cacheRead,
      },
    },
  });
}

function makeTurnDuration(ms: number) {
  return JSON.stringify({
    type: "system",
    subtype: "turn_duration",
    durationMs: ms,
    timestamp: "2026-01-15T10:00:00.000Z",
  });
}

describe("transcript-reader", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkdtempSync(join(os.tmpdir(), "transcript-test-")); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("reads token usage from assistant lines", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, [
      JSON.stringify({ type: "user", message: "hello" }),
      makeAssistantLine("req1", 500, 200, 15000, 0),
      makeAssistantLine("req2", 1, 800, 0, 15000),
    ].join("\n") + "\n");

    const state = createReaderState();
    const found = readTranscriptIncremental(file, state);

    expect(found).toBe(true);
    expect(state.usageByRequestId.size).toBe(2);

    const summary = buildSummary("s1", file, state);
    expect(summary.apiCalls).toBe(2);
    expect(summary.inputTokens).toBe(501);
    expect(summary.outputTokens).toBe(1000);
    expect(summary.cacheCreationTokens).toBe(15000);
    expect(summary.cacheReadTokens).toBe(15000);
  });

  it("deduplicates streaming entries by requestId (last-entry-wins)", () => {
    const file = join(tmpDir, "test.jsonl");
    // Simulate streaming: same requestId, output_tokens grows
    writeFileSync(file, [
      makeAssistantLine("req1", 3, 9, 20000, 0),
      makeAssistantLine("req1", 3, 9, 20000, 0),
      makeAssistantLine("req1", 3, 9, 20000, 0),
      makeAssistantLine("req1", 3, 253, 20000, 0),  // final
    ].join("\n") + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);

    expect(state.usageByRequestId.size).toBe(1);
    const summary = buildSummary("s1", file, state);
    expect(summary.outputTokens).toBe(253); // NOT 9+9+9+253
    expect(summary.apiCalls).toBe(1);
  });

  it("excludes <synthetic> model entries", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, [
      makeAssistantLine("req1", 500, 200, 0, 0, "claude-opus-4-6"),
      makeAssistantLine("req2", 100, 50, 0, 0, "<synthetic>"),
    ].join("\n") + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);

    const summary = buildSummary("s1", file, state);
    expect(summary.apiCalls).toBe(1);
    expect(summary.inputTokens).toBe(500);
  });

  it("reads incrementally — only new bytes", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, makeAssistantLine("req1", 100, 50) + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);
    expect(state.usageByRequestId.size).toBe(1);

    // Append new data
    appendFileSync(file, makeAssistantLine("req2", 200, 100) + "\n");
    readTranscriptIncremental(file, state);

    expect(state.usageByRequestId.size).toBe(2);
    const summary = buildSummary("s1", file, state);
    expect(summary.inputTokens).toBe(300);
  });

  it("handles partial last line across reads", () => {
    const file = join(tmpDir, "test.jsonl");
    const fullLine = makeAssistantLine("req1", 100, 50);
    // Write first half
    writeFileSync(file, fullLine.slice(0, 50));

    const state = createReaderState();
    readTranscriptIncremental(file, state);
    expect(state.usageByRequestId.size).toBe(0); // partial, not parsed yet
    expect(state.partialLine.length).toBeGreaterThan(0);

    // Write the rest + newline
    appendFileSync(file, fullLine.slice(50) + "\n");
    readTranscriptIncremental(file, state);
    expect(state.usageByRequestId.size).toBe(1);
  });

  it("handles file truncation (reset)", () => {
    const file = join(tmpDir, "test.jsonl");
    // Write a long file first
    const longContent = [
      makeAssistantLine("req1", 100, 50),
      makeAssistantLine("req2", 200, 100),
      makeAssistantLine("req3", 300, 150),
    ].join("\n") + "\n";
    writeFileSync(file, longContent);

    const state = createReaderState();
    readTranscriptIncremental(file, state);
    expect(state.byteOffset).toBeGreaterThan(0);
    expect(state.usageByRequestId.size).toBe(3);

    // Truncate to a short file (new session)
    writeFileSync(file, makeAssistantLine("req4", 400, 200) + "\n");
    readTranscriptIncremental(file, state);

    // Should have reset and re-read the shorter file
    expect(state.usageByRequestId.has("req4")).toBe(true);
  });

  it("handles missing file gracefully", () => {
    const state = createReaderState();
    expect(readTranscriptIncremental("/nonexistent.jsonl", state)).toBe(false);
  });

  it("tracks turn duration from system entries", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, [
      makeAssistantLine("req1", 100, 50),
      makeTurnDuration(5000),
      makeTurnDuration(3000),
    ].join("\n") + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);

    const summary = buildSummary("s1", file, state);
    expect(summary.totalTurnDurationMs).toBe(8000);
    expect(summary.turnCount).toBe(2);
  });

  it("computes context window from latest request", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, [
      makeAssistantLine("req1", 500, 200, 15000, 0),
      makeAssistantLine("req2", 1, 800, 0, 15000),
    ].join("\n") + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);

    const summary = buildSummary("s1", file, state);
    // Latest = req2: input(1) + cache_create(0) + cache_read(15000) = 15001
    expect(summary.latestContextTokens).toBe(15001);
  });

  it("identifies dominant model", () => {
    const file = join(tmpDir, "test.jsonl");
    writeFileSync(file, [
      makeAssistantLine("req1", 100, 50, 0, 0, "claude-opus-4-6"),
      makeAssistantLine("req2", 100, 50, 0, 0, "claude-opus-4-6"),
      makeAssistantLine("req3", 100, 50, 0, 0, "claude-sonnet-4-6"),
    ].join("\n") + "\n");

    const state = createReaderState();
    readTranscriptIncremental(file, state);

    const summary = buildSummary("s1", file, state);
    expect(summary.model).toBe("claude-opus-4-6");
  });
});

describe("readSubagentTranscripts", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkdtempSync(join(os.tmpdir(), "subagent-test-")); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("discovers and reads subagent transcript files", () => {
    // Main transcript: <tmpDir>/session123.jsonl
    const mainPath = join(tmpDir, "session123.jsonl");
    writeFileSync(mainPath, makeAssistantLine("req1", 1000, 500) + "\n");

    // Subagent dir: <tmpDir>/session123/subagents/
    const { mkdirSync } = require("node:fs");
    const subDir = join(tmpDir, "session123", "subagents");
    mkdirSync(subDir, { recursive: true });

    // Two subagent transcripts
    writeFileSync(join(subDir, "agent-abc123.jsonl"), [
      makeAssistantLine("sa-req1", 200, 100, 0, 0, "claude-sonnet-4-6"),
      makeAssistantLine("sa-req2", 300, 150, 0, 0, "claude-sonnet-4-6"),
    ].join("\n") + "\n");

    writeFileSync(join(subDir, "agent-def456.jsonl"), [
      makeAssistantLine("sa-req3", 400, 200, 5000, 0, "claude-haiku-4-5"),
    ].join("\n") + "\n");

    const results = readSubagentTranscripts(mainPath);
    expect(results).toHaveLength(2);

    const abc = results.find((r) => r.agentId === "abc123");
    expect(abc).toBeDefined();
    expect(abc!.model).toBe("claude-sonnet-4-6");
    expect(abc!.apiCalls).toBe(2);
    expect(abc!.inputTokens).toBe(500);
    expect(abc!.outputTokens).toBe(250);

    const def = results.find((r) => r.agentId === "def456");
    expect(def).toBeDefined();
    expect(def!.model).toBe("claude-haiku-4-5");
    expect(def!.apiCalls).toBe(1);
    expect(def!.cacheCreationTokens).toBe(5000);
  });

  it("returns empty array when no subagent dir exists", () => {
    const mainPath = join(tmpDir, "nosubagents.jsonl");
    writeFileSync(mainPath, makeAssistantLine("req1", 100, 50) + "\n");
    expect(readSubagentTranscripts(mainPath)).toEqual([]);
  });
});

describe("getContextLimit", () => {
  it("returns known model limits (Claude Code uses 1M)", () => {
    expect(getContextLimit("claude-opus-4-6")).toBe(1_000_000);
    expect(getContextLimit("claude-sonnet-4-6")).toBe(1_000_000);
    expect(getContextLimit("claude-haiku-4-5")).toBe(200_000);
  });

  it("returns default for unknown models", () => {
    expect(getContextLimit("gpt-4o")).toBe(200_000);
  });
});
