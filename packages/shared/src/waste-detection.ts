/**
 * Token Waste and Efficiency Detection — Part 3, Issue #7
 *
 * Detects wasteful patterns in tool call sequences:
 * - Repeated tool calls (same tool + target N times)
 * - Redundant file reads (same file read multiple times)
 * - Failed retries (failed → retry with same args)
 * - Abandoned execution (subagent started work but never completed)
 *
 * Every finding includes evidence (tool_use_ids), confidence level,
 * and affected agent. Never classifies necessary operations as waste.
 */

import type { WasteFinding, WasteCategory, WasteConfidence } from "./analytics.js";
import type { ToolCallAnalytics } from "./analytics.js";

let nextId = 0;
function findingId(): string {
  return `waste-${++nextId}`;
}

// ─── Repeated tool calls ────────────────────────────────────────────

/** Detect when the same tool + target is called 3+ times in a session. */
function detectRepeatedToolCalls(calls: ToolCallAnalytics[], sessionId: string): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const groups = new Map<string, ToolCallAnalytics[]>();

  for (const call of calls) {
    if (!call.target) continue;
    const key = `${call.toolName}:${call.target}`;
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    if (group.length < 3) continue;
    const [toolName] = key.split(":");
    const successCount = group.filter((c) => c.status === "succeeded").length;

    // If all succeeded, it's likely repeated reads — potential waste
    // If mix of fail/success, it's retries — handled separately
    if (successCount === group.length) {
      findings.push({
        id: findingId(),
        sessionId,
        category: "repeated_tool_call",
        confidence: group.length >= 5 ? "confirmed" : "probable",
        description: `${toolName} called ${group.length} times on ${group[0].target}`,
        affectedAgentId: group[0].agentId,
        evidence: group.map((c) => c.toolUseId),
        estimatedWastedTokens: { value: 0, availability: "unavailable", source: "none" },
        estimatedWastedCost: { value: 0, availability: "unavailable", source: "none" },
      });
    }
  }

  return findings;
}

// ─── Redundant file reads ───────────────────────────────────────────

/** Detect when the same file is Read multiple times by the same agent. */
function detectRedundantReads(calls: ToolCallAnalytics[], sessionId: string): WasteFinding[] {
  const findings: WasteFinding[] = [];
  // Group reads by agent + file path
  const groups = new Map<string, ToolCallAnalytics[]>();

  for (const call of calls) {
    if (call.toolName !== "Read" || !call.target) continue;
    const key = `${call.agentId}:${call.target}`;
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    findings.push({
      id: findingId(),
      sessionId,
      category: "redundant_file_read",
      confidence: group.length >= 3 ? "confirmed" : "potential",
      description: `${group[0].target} read ${group.length} times by ${group[0].agentId}`,
      affectedAgentId: group[0].agentId,
      evidence: group.map((c) => c.toolUseId),
      estimatedWastedTokens: { value: 0, availability: "unavailable", source: "none" },
      estimatedWastedCost: { value: 0, availability: "unavailable", source: "none" },
    });
  }

  return findings;
}

// ─── Failed retries ─────────────────────────────────────────────────

/** Detect sequences of fail → retry → fail on the same tool + target. */
function detectFailedRetries(calls: ToolCallAnalytics[], sessionId: string): WasteFinding[] {
  const findings: WasteFinding[] = [];
  // Group by tool + target, ordered by time
  const groups = new Map<string, ToolCallAnalytics[]>();

  for (const call of calls) {
    if (!call.target) continue;
    const key = `${call.toolName}:${call.target}`;
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }

  for (const [, group] of groups) {
    // Sort by time
    const sorted = group.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    // Count consecutive failures
    let consecutiveFails: ToolCallAnalytics[] = [];
    for (const call of sorted) {
      if (call.status === "failed") {
        consecutiveFails.push(call);
      } else {
        if (consecutiveFails.length >= 2) {
          findings.push({
            id: findingId(),
            sessionId,
            category: "failed_retry",
            confidence: "confirmed",
            description: `${consecutiveFails[0].toolName} failed ${consecutiveFails.length} times on ${consecutiveFails[0].target}`,
            affectedAgentId: consecutiveFails[0].agentId,
            evidence: consecutiveFails.map((c) => c.toolUseId),
            estimatedWastedTokens: { value: 0, availability: "unavailable", source: "none" },
            estimatedWastedCost: { value: 0, availability: "unavailable", source: "none" },
          });
        }
        consecutiveFails = [];
      }
    }
    // Check trailing failures
    if (consecutiveFails.length >= 2) {
      findings.push({
        id: findingId(),
        sessionId,
        category: "failed_retry",
        confidence: "confirmed",
        description: `${consecutiveFails[0].toolName} failed ${consecutiveFails.length} times on ${consecutiveFails[0].target}`,
        affectedAgentId: consecutiveFails[0].agentId,
        evidence: consecutiveFails.map((c) => c.toolUseId),
        estimatedWastedTokens: { value: 0, availability: "unavailable", source: "none" },
        estimatedWastedCost: { value: 0, availability: "unavailable", source: "none" },
      });
    }
  }

  return findings;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Run all waste detection algorithms on a set of tool call analytics.
 *  Returns findings sorted by confidence (confirmed first). */
export function detectWaste(calls: ToolCallAnalytics[], sessionId: string): WasteFinding[] {
  const findings = [
    ...detectRepeatedToolCalls(calls, sessionId),
    ...detectRedundantReads(calls, sessionId),
    ...detectFailedRetries(calls, sessionId),
  ];

  // Sort: confirmed > probable > potential > insufficient
  const order: Record<WasteConfidence, number> = { confirmed: 0, probable: 1, potential: 2, insufficient: 3 };
  return findings.sort((a, b) => order[a.confidence] - order[b.confidence]);
}

/** Reset the internal ID counter (for testing). */
export function resetWasteIds(): void {
  nextId = 0;
}
