/**
 * Knowledge Gap Detection and Recommendations — Part 3, Issue #16
 *
 * Detects knowledge gaps from session patterns:
 * - Repeated architecture rediscovery (same file read across sessions)
 * - Recurring errors on the same target
 * - Missing documentation suggestions
 *
 * NEVER modifies files without explicit approval.
 * requiresApproval is always true on every recommendation.
 */

import type { KnowledgeGap } from "./analytics.js";
import type { ToolCallAnalytics } from "./analytics.js";

let nextId = 0;
function gapId(): string {
  return `kg-${++nextId}`;
}

/** Detect knowledge gaps from tool call patterns across one or more sessions. */
export function detectKnowledgeGaps(
  calls: ToolCallAnalytics[],
  sessionId: string
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  gaps.push(...detectRepeatedRediscovery(calls, sessionId));
  gaps.push(...detectRecurringErrors(calls, sessionId));
  gaps.push(...detectMissingRules(calls, sessionId));

  return gaps;
}

/** Files read repeatedly across different agents suggest missing project docs. */
function detectRepeatedRediscovery(calls: ToolCallAnalytics[], sessionId: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  // Group read calls by target, count unique agents
  const readsByFile = new Map<string, Set<string>>();

  for (const call of calls) {
    if (call.toolName !== "Read" || !call.target) continue;
    const agents = readsByFile.get(call.target) ?? new Set();
    agents.add(call.agentId);
    readsByFile.set(call.target, agents);
  }

  for (const [file, agents] of readsByFile) {
    if (agents.size >= 2) {
      gaps.push({
        id: gapId(),
        sessionId,
        description: `${file} was read by ${agents.size} different agents — architecture may not be documented`,
        evidence: Array.from(agents).map((a) => `agent:${a}`),
        gapType: "repeated_rediscovery",
        recommendation: `Add a summary of ${file}'s purpose and API to CLAUDE.md or a docs/ file`,
        requiresApproval: true,
      });
    }
  }

  return gaps;
}

/** Same tool+target failing repeatedly suggests a missing rule or convention. */
function detectRecurringErrors(calls: ToolCallAnalytics[], sessionId: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const failuresByTarget = new Map<string, ToolCallAnalytics[]>();

  for (const call of calls) {
    if (call.status !== "failed" || !call.target) continue;
    const existing = failuresByTarget.get(call.target) ?? [];
    existing.push(call);
    failuresByTarget.set(call.target, existing);
  }

  for (const [target, failures] of failuresByTarget) {
    if (failures.length >= 3) {
      gaps.push({
        id: gapId(),
        sessionId,
        description: `${target} failed ${failures.length} times — suggests a missing convention or constraint`,
        evidence: failures.map((f) => f.toolUseId),
        gapType: "recurring_error",
        recommendation: `Document the expected approach for ${target} in CLAUDE.md to prevent future failures`,
        requiresApproval: true,
      });
    }
  }

  return gaps;
}

/** If agents repeatedly read config/setup files, suggest documenting setup rules. */
function detectMissingRules(calls: ToolCallAnalytics[], sessionId: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const configReads = new Map<string, number>();
  const configPatterns = /\.(config|rc|env|json|yaml|yml|toml)\b|tsconfig|eslint|prettier|jest\.config/i;

  for (const call of calls) {
    if (call.toolName !== "Read" || !call.target) continue;
    if (configPatterns.test(call.target)) {
      configReads.set(call.target, (configReads.get(call.target) ?? 0) + 1);
    }
  }

  for (const [file, count] of configReads) {
    if (count >= 3) {
      gaps.push({
        id: gapId(),
        sessionId,
        description: `Config file ${file} read ${count} times — project conventions may not be documented`,
        evidence: [`${count} reads of ${file}`],
        gapType: "missing_rule",
        recommendation: `Add relevant rules from ${file} to CLAUDE.md so agents don't need to re-read it`,
        requiresApproval: true,
      });
    }
  }

  return gaps;
}

/** Reset the internal ID counter (for testing). */
export function resetGapIds(): void {
  nextId = 0;
}
