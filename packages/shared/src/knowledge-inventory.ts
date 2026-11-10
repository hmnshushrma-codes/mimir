/**
 * Knowledge Inventory and Context Intelligence — Part 3, Issue #15
 *
 * Inspects tool call patterns to identify project knowledge sources:
 * - CLAUDE.md files (read by agents)
 * - Frequently accessed files (read 3+ times across sessions)
 * - User corrections (edits following failed tool calls)
 *
 * Does NOT assume access to every Claude Code context source —
 * only infers from observable tool call data.
 */

import type { KnowledgeItem, KnowledgeSourceType } from "./analytics.js";
import type { ToolCallAnalytics } from "./analytics.js";

let nextId = 0;
function itemId(): string {
  return `ki-${++nextId}`;
}

/** Build a knowledge inventory from tool call analytics. */
export function buildKnowledgeInventory(calls: ToolCallAnalytics[]): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const fileAccessCounts = new Map<string, { count: number; firstSeen: string; lastSeen: string }>();

  for (const call of calls) {
    if (!call.target) continue;

    // Track file access frequency
    if (call.category === "read" || (call.toolName === "Read" || call.toolName === "Glob" || call.toolName === "Grep")) {
      const existing = fileAccessCounts.get(call.target);
      if (existing) {
        existing.count++;
        if (call.startedAt > existing.lastSeen) existing.lastSeen = call.startedAt;
      } else {
        fileAccessCounts.set(call.target, { count: 1, firstSeen: call.startedAt, lastSeen: call.startedAt });
      }
    }
  }

  // Identify knowledge sources
  for (const [path, stats] of fileAccessCounts) {
    const type = classifyKnowledgeSource(path);
    if (type === "claude_md" || type === "project_instructions") {
      // Always include CLAUDE.md and project instructions
      items.push({
        id: itemId(),
        type,
        path,
        description: describeKnowledgeSource(type, path),
        firstSeen: stats.firstSeen,
        accessCount: stats.count,
      });
    } else if (stats.count >= 3) {
      // Frequently accessed files
      items.push({
        id: itemId(),
        type: "frequently_accessed_file",
        path,
        description: `Accessed ${stats.count} times`,
        firstSeen: stats.firstSeen,
        accessCount: stats.count,
      });
    }
  }

  // Sort by access count (most accessed first)
  return items.sort((a, b) => b.accessCount - a.accessCount);
}

function classifyKnowledgeSource(path: string): KnowledgeSourceType {
  const lower = path.toLowerCase();
  if (lower.includes("claude.md") || lower.includes("claude_md")) return "claude_md";
  if (lower.includes("agents.md") || lower.includes(".claude/")) return "project_instructions";
  if (lower.includes("readme") || lower.includes("contributing") || lower.includes("docs/")) return "documentation";
  return "frequently_accessed_file";
}

function describeKnowledgeSource(type: KnowledgeSourceType, path: string): string {
  switch (type) {
    case "claude_md": return `Project instructions (${path})`;
    case "project_instructions": return `Agent/project configuration (${path})`;
    case "documentation": return `Documentation (${path})`;
    default: return `Frequently accessed file (${path})`;
  }
}

/** Detect user correction patterns: an Edit/Write following a failed tool call
 *  on the same file suggests the user corrected the approach. */
export function detectUserCorrections(calls: ToolCallAnalytics[]): KnowledgeItem[] {
  const corrections: KnowledgeItem[] = [];
  const sorted = [...calls].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Pattern: failed read/write → edit on the same file
    if (prev.status === "failed" && curr.status === "succeeded"
      && (curr.toolName === "Edit" || curr.toolName === "Write")
      && prev.target && curr.target && prev.target === curr.target) {
      corrections.push({
        id: itemId(),
        type: "user_correction",
        path: curr.target,
        description: `Correction after ${prev.toolName} failure on ${curr.target}`,
        firstSeen: curr.startedAt,
        accessCount: 1,
      });
    }
  }

  return corrections;
}

/** Reset the internal ID counter (for testing). */
export function resetKnowledgeIds(): void {
  nextId = 0;
}
