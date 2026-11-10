/**
 * Model Pricing and Cost Intelligence — Part 3, Issue #6
 *
 * Configurable model-pricing registry with Claude model defaults.
 * Calculates session/agent/task costs from token usage data.
 * When token data is unavailable, costs are marked unavailable — never fabricated.
 */

import type { TokenUsage, ModelPricing, CostBreakdown, MaybeAvailable } from "./analytics.js";

// ─── Default pricing table (Anthropic Claude models) ────────────────
// Source: https://docs.anthropic.com/en/docs/about-claude/models
// Prices per million tokens, USD.

export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  {
    provider: "anthropic",
    model: "claude-opus-4-6",
    inputPricePerMToken: 15.0,
    outputPricePerMToken: 75.0,
    cacheCreationPricePerMToken: 18.75,
    cacheReadPricePerMToken: 1.50,
    currency: "USD",
    effectiveDate: "2025-05-22",
    source: "docs.anthropic.com/en/docs/about-claude/models",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputPricePerMToken: 3.0,
    outputPricePerMToken: 15.0,
    cacheCreationPricePerMToken: 3.75,
    cacheReadPricePerMToken: 0.30,
    currency: "USD",
    effectiveDate: "2025-05-22",
    source: "docs.anthropic.com/en/docs/about-claude/models",
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    inputPricePerMToken: 0.80,
    outputPricePerMToken: 4.0,
    cacheCreationPricePerMToken: 1.0,
    cacheReadPricePerMToken: 0.08,
    currency: "USD",
    effectiveDate: "2025-05-22",
    source: "docs.anthropic.com/en/docs/about-claude/models",
  },
];

// ─── Pricing registry ───────────────────────────────────────────────

export class PricingRegistry {
  private models = new Map<string, ModelPricing>();

  constructor(initial: ModelPricing[] = DEFAULT_MODEL_PRICING) {
    for (const p of initial) this.models.set(p.model, p);
  }

  /** Look up pricing for a model. Tries exact match first, then prefix match
   *  (e.g. "claude-opus-4-6" matches "claude-opus-4-6[1m]"). */
  get(model: string): ModelPricing | null {
    const exact = this.models.get(model);
    if (exact) return exact;
    // Prefix match: "claude-opus-4-6" should match "claude-opus-4-6[1m]" etc.
    for (const [key, pricing] of this.models) {
      if (model.startsWith(key) || key.startsWith(model)) return pricing;
    }
    return null;
  }

  set(pricing: ModelPricing): void {
    this.models.set(pricing.model, pricing);
  }

  list(): ModelPricing[] {
    return Array.from(this.models.values());
  }
}

// ─── Cost calculation ───────────────────────────────────────────────

function costForTokens(tokens: number, pricePerMToken: number): number {
  return (tokens / 1_000_000) * pricePerMToken;
}

function unavailableCost(currency: string): CostBreakdown {
  const u: MaybeAvailable<number> = { value: 0, availability: "unavailable", source: "none" };
  return { inputCost: u, outputCost: u, cacheCost: u, totalCost: u, currency, model: null };
}

/** Calculate costs from token usage and a model name.
 *  If tokens are unavailable or model is unknown, returns unavailable costs. */
export function calculateCost(
  usage: TokenUsage,
  model: string | null,
  registry: PricingRegistry = new PricingRegistry()
): CostBreakdown {
  if (usage.inputTokens.availability === "unavailable") {
    return unavailableCost("USD");
  }
  if (!model) {
    return unavailableCost("USD");
  }

  const pricing = registry.get(model);
  if (!pricing) {
    return unavailableCost("USD");
  }

  const inputCost = costForTokens(usage.inputTokens.value, pricing.inputPricePerMToken);
  const outputCost = costForTokens(usage.outputTokens.value, pricing.outputPricePerMToken);
  const cacheCreateCost = costForTokens(usage.cacheCreationTokens.value, pricing.cacheCreationPricePerMToken);
  const cacheReadCost = costForTokens(usage.cacheReadTokens.value, pricing.cacheReadPricePerMToken);
  const cacheCost = cacheCreateCost + cacheReadCost;
  const total = inputCost + outputCost + cacheCost;

  const source = `${pricing.source} (${pricing.effectiveDate})`;
  const availability = usage.inputTokens.availability;

  return {
    inputCost: { value: inputCost, availability, source },
    outputCost: { value: outputCost, availability, source },
    cacheCost: { value: cacheCost, availability, source },
    totalCost: { value: total, availability, source },
    currency: pricing.currency,
    model,
  };
}

/** Format a cost value for display (e.g. "$0.0234"). */
export function formatCost(cost: MaybeAvailable<number>, currency: string = "USD"): string {
  if (cost.availability === "unavailable") return "—";
  const symbol = currency === "USD" ? "$" : currency;
  if (cost.value < 0.01) return `${symbol}${cost.value.toFixed(4)}`;
  if (cost.value < 1) return `${symbol}${cost.value.toFixed(3)}`;
  return `${symbol}${cost.value.toFixed(2)}`;
}
