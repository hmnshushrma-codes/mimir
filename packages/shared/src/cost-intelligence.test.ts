import { describe, expect, it } from "vitest";
import {
  PricingRegistry,
  DEFAULT_MODEL_PRICING,
  calculateCost,
  formatCost,
} from "./cost-intelligence.js";
import { EMPTY_TOKEN_USAGE, type TokenUsage } from "./analytics.js";
import {
  extractUsageFromTranscriptLines,
  aggregateTokenUsage,
  dominantModel,
} from "./token-accounting.js";

describe("PricingRegistry", () => {
  it("has 3 default Claude models", () => {
    const registry = new PricingRegistry();
    expect(registry.list()).toHaveLength(3);
  });

  it("looks up by exact model name", () => {
    const registry = new PricingRegistry();
    const opus = registry.get("claude-opus-4-6");
    expect(opus).not.toBeNull();
    expect(opus!.inputPricePerMToken).toBe(15.0);
    expect(opus!.outputPricePerMToken).toBe(75.0);
  });

  it("looks up by prefix match (model with suffix)", () => {
    const registry = new PricingRegistry();
    // Real Claude Code uses "claude-opus-4-6[1m]" as model ID
    const opus = registry.get("claude-opus-4-6[1m]");
    expect(opus).not.toBeNull();
    expect(opus!.model).toBe("claude-opus-4-6");
  });

  it("returns null for unknown models", () => {
    const registry = new PricingRegistry();
    expect(registry.get("gpt-4o")).toBeNull();
  });

  it("allows custom pricing overrides", () => {
    const registry = new PricingRegistry();
    registry.set({
      provider: "custom",
      model: "my-model",
      inputPricePerMToken: 1.0,
      outputPricePerMToken: 2.0,
      cacheCreationPricePerMToken: 0.5,
      cacheReadPricePerMToken: 0.1,
      currency: "EUR",
      effectiveDate: "2026-01-01",
      source: "custom",
    });
    const custom = registry.get("my-model");
    expect(custom).not.toBeNull();
    expect(custom!.currency).toBe("EUR");
    expect(registry.list()).toHaveLength(4);
  });
});

describe("calculateCost", () => {
  const registry = new PricingRegistry();

  it("calculates correct costs for Opus with known tokens", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 10_000, availability: "measured", source: "transcript" },
      outputTokens: { value: 5_000, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 20_000, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 15_000, availability: "measured", source: "transcript" },
    };

    const cost = calculateCost(usage, "claude-opus-4-6", registry);
    // input: 10k * $15/M = $0.15
    expect(cost.inputCost.value).toBeCloseTo(0.15, 4);
    // output: 5k * $75/M = $0.375
    expect(cost.outputCost.value).toBeCloseTo(0.375, 4);
    // cache: 20k * $18.75/M + 15k * $1.50/M = $0.375 + $0.0225 = $0.3975
    expect(cost.cacheCost.value).toBeCloseTo(0.3975, 4);
    // total: 0.15 + 0.375 + 0.3975 = $0.9225
    expect(cost.totalCost.value).toBeCloseTo(0.9225, 4);
    expect(cost.totalCost.availability).toBe("measured");
    expect(cost.currency).toBe("USD");
    expect(cost.model).toBe("claude-opus-4-6");
  });

  it("calculates correct costs for Sonnet", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 100_000, availability: "measured", source: "transcript" },
      outputTokens: { value: 10_000, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 0, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 50_000, availability: "measured", source: "transcript" },
    };

    const cost = calculateCost(usage, "claude-sonnet-4-6", registry);
    // input: 100k * $3/M = $0.30
    expect(cost.inputCost.value).toBeCloseTo(0.30, 4);
    // output: 10k * $15/M = $0.15
    expect(cost.outputCost.value).toBeCloseTo(0.15, 4);
    // cache: 0 + 50k * $0.30/M = $0.015
    expect(cost.cacheCost.value).toBeCloseTo(0.015, 4);
    expect(cost.totalCost.value).toBeCloseTo(0.465, 4);
  });

  it("returns unavailable when tokens are unavailable", () => {
    const cost = calculateCost(EMPTY_TOKEN_USAGE, "claude-opus-4-6", registry);
    expect(cost.totalCost.availability).toBe("unavailable");
    expect(cost.totalCost.value).toBe(0);
  });

  it("returns unavailable when model is null", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 1000, availability: "measured", source: "transcript" },
      outputTokens: { value: 500, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 0, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 0, availability: "measured", source: "transcript" },
    };
    const cost = calculateCost(usage, null, registry);
    expect(cost.totalCost.availability).toBe("unavailable");
  });

  it("returns unavailable for unknown model", () => {
    const usage: TokenUsage = {
      inputTokens: { value: 1000, availability: "measured", source: "transcript" },
      outputTokens: { value: 500, availability: "measured", source: "transcript" },
      cacheCreationTokens: { value: 0, availability: "measured", source: "transcript" },
      cacheReadTokens: { value: 0, availability: "measured", source: "transcript" },
    };
    const cost = calculateCost(usage, "gpt-4o", registry);
    expect(cost.totalCost.availability).toBe("unavailable");
  });
});

describe("formatCost", () => {
  it("formats small costs with 4 decimal places", () => {
    expect(formatCost({ value: 0.0023, availability: "measured", source: "t" })).toBe("$0.0023");
  });

  it("formats medium costs with 3 decimal places", () => {
    expect(formatCost({ value: 0.456, availability: "measured", source: "t" })).toBe("$0.456");
  });

  it("formats large costs with 2 decimal places", () => {
    expect(formatCost({ value: 12.34, availability: "measured", source: "t" })).toBe("$12.34");
  });

  it("returns dash for unavailable", () => {
    expect(formatCost({ value: 0, availability: "unavailable", source: "none" })).toBe("—");
  });
});

describe("integration — full pipeline: transcript → tokens → cost", () => {
  it("calculates session cost from realistic transcript data", () => {
    // Simulate a real session with 3 assistant messages
    const transcriptLines = [
      { type: "user", sessionId: "s1", message: { content: [{ type: "text", text: "fix the bug" }] } },
      {
        type: "assistant", sessionId: "s1", timestamp: "2026-01-15T10:00:00Z",
        message: {
          type: "message", model: "claude-opus-4-6",
          usage: { input_tokens: 500, output_tokens: 200, cache_creation_input_tokens: 15000, cache_read_input_tokens: 0 },
        },
      },
      {
        type: "assistant", sessionId: "s1", timestamp: "2026-01-15T10:00:05Z",
        message: {
          type: "message", model: "claude-opus-4-6",
          usage: { input_tokens: 14000, output_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 15000 },
        },
      },
      {
        type: "assistant", sessionId: "s1", timestamp: "2026-01-15T10:00:10Z",
        message: {
          type: "message", model: "claude-opus-4-6",
          usage: { input_tokens: 14200, output_tokens: 3000, cache_creation_input_tokens: 200, cache_read_input_tokens: 15000 },
        },
      },
    ];

    // Step 1: Extract usage from transcript
    const entries = extractUsageFromTranscriptLines(transcriptLines);
    expect(entries).toHaveLength(3);

    // Step 2: Aggregate tokens
    const usage = aggregateTokenUsage(entries);
    expect(usage.inputTokens.value).toBe(500 + 14000 + 14200);     // 28700
    expect(usage.outputTokens.value).toBe(200 + 1500 + 3000);       // 4700
    expect(usage.cacheCreationTokens.value).toBe(15000 + 0 + 200);  // 15200
    expect(usage.cacheReadTokens.value).toBe(0 + 15000 + 15000);    // 30000

    // Step 3: Identify model
    const model = dominantModel(entries);
    expect(model).toBe("claude-opus-4-6");

    // Step 4: Calculate cost
    const cost = calculateCost(usage, model, new PricingRegistry());
    expect(cost.totalCost.availability).toBe("measured");
    expect(cost.currency).toBe("USD");
    expect(cost.model).toBe("claude-opus-4-6");

    // Verify math:
    // input: 28700 * $15/M = $0.4305
    expect(cost.inputCost.value).toBeCloseTo(0.4305, 3);
    // output: 4700 * $75/M = $0.3525
    expect(cost.outputCost.value).toBeCloseTo(0.3525, 3);
    // cache: 15200 * $18.75/M + 30000 * $1.50/M = $0.285 + $0.045 = $0.330
    expect(cost.cacheCost.value).toBeCloseTo(0.330, 3);
    // total: 0.4305 + 0.3525 + 0.330 = $1.113
    expect(cost.totalCost.value).toBeCloseTo(1.113, 2);

    // Formatted
    expect(formatCost(cost.totalCost)).toBe("$1.11");
  });
});
