import { describe, expect, it } from "vitest";
import {
  extractUsageFromTranscriptLines,
  aggregateTokenUsage,
  dominantModel,
  sumTokenUsage,
  totalTokens,
  type TranscriptEntry,
  type TranscriptUsage,
} from "./token-accounting.js";
import { EMPTY_TOKEN_USAGE, type TokenUsage } from "./analytics.js";

// ─── Realistic transcript lines matching the actual .jsonl format ───

const ASSISTANT_LINE_1 = {
  type: "assistant",
  sessionId: "s1",
  timestamp: "2026-01-15T10:00:00.000Z",
  message: {
    type: "message",
    model: "claude-opus-4-6",
    usage: {
      input_tokens: 3,
      output_tokens: 150,
      cache_creation_input_tokens: 20649,
      cache_read_input_tokens: 0,
      service_tier: "standard",
    },
  },
};

const ASSISTANT_LINE_2 = {
  type: "assistant",
  sessionId: "s1",
  timestamp: "2026-01-15T10:00:05.000Z",
  message: {
    type: "message",
    model: "claude-opus-4-6",
    usage: {
      input_tokens: 18500,
      output_tokens: 800,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 20649,
    },
  },
};

const ASSISTANT_LINE_SONNET = {
  type: "assistant",
  sessionId: "s1",
  timestamp: "2026-01-15T10:00:10.000Z",
  message: {
    type: "message",
    model: "claude-sonnet-4-6",
    usage: {
      input_tokens: 5000,
      output_tokens: 2000,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 300,
    },
  },
};

const USER_LINE = {
  type: "user",
  sessionId: "s1",
  message: { content: [{ type: "text", text: "Fix the bug" }] },
};

const PERMISSION_LINE = {
  type: "permission-mode",
  sessionId: "s1",
  permissionMode: "default",
};

describe("extractUsageFromTranscriptLines", () => {
  it("extracts usage from assistant lines", () => {
    const entries = extractUsageFromTranscriptLines([ASSISTANT_LINE_1, ASSISTANT_LINE_2]);
    expect(entries).toHaveLength(2);
    expect(entries[0].usage.input_tokens).toBe(3);
    expect(entries[0].usage.cache_creation_input_tokens).toBe(20649);
    expect(entries[0].model).toBe("claude-opus-4-6");
    expect(entries[1].usage.input_tokens).toBe(18500);
    expect(entries[1].usage.cache_read_input_tokens).toBe(20649);
  });

  it("skips non-assistant lines", () => {
    const entries = extractUsageFromTranscriptLines([USER_LINE, PERMISSION_LINE, ASSISTANT_LINE_1]);
    expect(entries).toHaveLength(1);
    expect(entries[0].usage.input_tokens).toBe(3);
  });

  it("skips assistant lines without usage", () => {
    const noUsage = { type: "assistant", sessionId: "s1", message: { type: "message" } };
    const entries = extractUsageFromTranscriptLines([noUsage]);
    expect(entries).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(extractUsageFromTranscriptLines([])).toHaveLength(0);
  });

  it("handles malformed objects gracefully", () => {
    const entries = extractUsageFromTranscriptLines([null, undefined, 42, "string", {}]);
    expect(entries).toHaveLength(0);
  });
});

describe("aggregateTokenUsage", () => {
  it("aggregates multiple entries into a single TokenUsage with measured availability", () => {
    const entries = extractUsageFromTranscriptLines([ASSISTANT_LINE_1, ASSISTANT_LINE_2]);
    const usage = aggregateTokenUsage(entries);

    expect(usage.inputTokens.value).toBe(3 + 18500);
    expect(usage.inputTokens.availability).toBe("measured");
    expect(usage.inputTokens.source).toBe("transcript");

    expect(usage.outputTokens.value).toBe(150 + 800);
    expect(usage.cacheCreationTokens.value).toBe(20649 + 0);
    expect(usage.cacheReadTokens.value).toBe(0 + 20649);
  });

  it("returns EMPTY (unavailable) for no entries", () => {
    const usage = aggregateTokenUsage([]);
    expect(usage.inputTokens.availability).toBe("unavailable");
    expect(usage.inputTokens.value).toBe(0);
  });
});

describe("dominantModel", () => {
  it("returns the most frequent model", () => {
    const entries = extractUsageFromTranscriptLines([
      ASSISTANT_LINE_1, ASSISTANT_LINE_2, ASSISTANT_LINE_SONNET,
    ]);
    // 2x opus, 1x sonnet → opus wins
    expect(dominantModel(entries)).toBe("claude-opus-4-6");
  });

  it("returns null for empty entries", () => {
    expect(dominantModel([])).toBeNull();
  });

  it("returns null when no entries have a model", () => {
    const entries: TranscriptEntry[] = [{
      sessionId: "s1",
      model: null,
      usage: { input_tokens: 1, output_tokens: 1 },
      timestamp: "2026-01-01T00:00:00Z",
    }];
    expect(dominantModel(entries)).toBeNull();
  });
});

describe("sumTokenUsage", () => {
  it("sums two measured usages", () => {
    const a: TokenUsage = {
      inputTokens: { value: 100, availability: "measured", source: "transcript" },
      outputTokens: { value: 50, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 10, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 5, availability: "measured", source: "transcript" },
    };
    const b: TokenUsage = {
      inputTokens: { value: 200, availability: "measured", source: "transcript" },
      outputTokens: { value: 100, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 20, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 15, availability: "measured", source: "transcript" },
    };
    const sum = sumTokenUsage(a, b);
    expect(sum.inputTokens.value).toBe(300);
    expect(sum.inputTokens.availability).toBe("measured");
  });

  it("returns unavailable when both are unavailable", () => {
    const sum = sumTokenUsage(EMPTY_TOKEN_USAGE, EMPTY_TOKEN_USAGE);
    expect(sum.inputTokens.availability).toBe("unavailable");
    expect(sum.inputTokens.value).toBe(0);
  });

  it("preserves measured when one side has data", () => {
    const measured: TokenUsage = {
      inputTokens: { value: 100, availability: "measured", source: "transcript" },
      outputTokens: { value: 50, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 0, availability: "unavailable", source: "none" },
      cacheReadTokens: { value: 0, availability: "unavailable", source: "none" },
    };
    const sum = sumTokenUsage(measured, EMPTY_TOKEN_USAGE);
    expect(sum.inputTokens.availability).toBe("measured");
    expect(sum.inputTokens.value).toBe(100);
    expect(sum.cacheCreationTokens.availability).toBe("unavailable");
  });
});

describe("totalTokens", () => {
  it("sums all token types", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 1000, availability: "measured", source: "transcript" },
      outputTokens: { value: 500, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 200, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 100, availability: "measured", source: "transcript" },
    };
    const total = totalTokens(usage);
    expect(total.value).toBe(1800);
    expect(total.availability).toBe("measured");
  });

  it("returns unavailable when input is unavailable", () => {
    const total = totalTokens(EMPTY_TOKEN_USAGE);
    expect(total.availability).toBe("unavailable");
    expect(total.value).toBe(0);
  });
});

describe("integration — realistic multi-model session", () => {
  it("aggregates a session with mixed models and cache patterns", () => {
    const lines = [
      USER_LINE,
      PERMISSION_LINE,
      ASSISTANT_LINE_1,     // opus: 3 in, 150 out, 20649 cache_create
      ASSISTANT_LINE_2,     // opus: 18500 in, 800 out, 20649 cache_read
      USER_LINE,
      ASSISTANT_LINE_SONNET, // sonnet: 5000 in, 2000 out, 100 cache_create, 300 cache_read
    ];

    const entries = extractUsageFromTranscriptLines(lines);
    expect(entries).toHaveLength(3);

    const usage = aggregateTokenUsage(entries);
    expect(usage.inputTokens.value).toBe(3 + 18500 + 5000); // 23503
    expect(usage.outputTokens.value).toBe(150 + 800 + 2000); // 2950
    expect(usage.cacheCreationTokens.value).toBe(20649 + 0 + 100); // 20749
    expect(usage.cacheReadTokens.value).toBe(0 + 20649 + 300); // 20949

    const total = totalTokens(usage);
    expect(total.value).toBe(23503 + 2950 + 20749 + 20949); // 68151
    expect(total.availability).toBe("measured");

    expect(dominantModel(entries)).toBe("claude-opus-4-6"); // 2 vs 1
  });
});
