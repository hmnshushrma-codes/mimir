/**
 * Derives higher-level metrics from raw hook events:
 * - Lines added/removed (from Edit/Write tool inputs)
 * - Git operations (from Bash commands)
 * - MCP calls (tool names starting with mcp__)
 * - Files modified (unique paths from Edit/Write/MultiEdit)
 * - Success rate (tool calls - failures / total)
 *
 * All values are approximate — marked as such in the UI.
 */

import type { WorkshopEvent } from "./workshop-event.js";

export interface DerivedMetrics {
  linesAdded: number;
  linesRemoved: number;
  /** Approximate — counted from Edit old_string/new_string diffs and Write content */
  linesApproximate: true;
  gitOperations: number;
  gitOpsBreakdown: Record<string, number>;
  mcpCalls: number;
  filesModified: number;
  /** Unique file paths */
  modifiedFiles: Set<string>;
  totalToolCalls: number;
  failedToolCalls: number;
  successRate: number; // 0–100
}

const GIT_COMMANDS = [
  "commit", "push", "pull", "merge", "rebase", "checkout",
  "branch", "stash", "reset", "cherry-pick", "tag", "fetch",
  "clone", "diff", "log", "status", "add",
];

const GIT_PATTERN = new RegExp(`\\bgit\\s+(${GIT_COMMANDS.join("|")})\\b`);

/** Count lines in a string (0 for empty/null). */
function lineCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s.split("\n").length;
}

/** Extract git subcommand from a bash command, or null. */
function extractGitOp(command: string): string | null {
  const match = GIT_PATTERN.exec(command);
  return match ? match[1] : null;
}

/** Compute derived metrics from a list of WorkshopEvents. */
export function deriveMetrics(events: WorkshopEvent[]): DerivedMetrics {
  const modifiedFiles = new Set<string>();
  let linesAdded = 0;
  let linesRemoved = 0;
  let gitOperations = 0;
  const gitOpsBreakdown: Record<string, number> = {};
  let mcpCalls = 0;
  let totalToolCalls = 0;
  let failedToolCalls = 0;

  for (const e of events) {
    const raw = e.raw as Record<string, unknown>;
    const toolInput = raw?.tool_input as Record<string, unknown> | undefined;
    const toolName = e.toolName;

    // Count tool calls
    if (e.hookEventName === "PreToolUse") {
      totalToolCalls++;
    }
    if (e.hookEventName === "PostToolUseFailure") {
      failedToolCalls++;
    }

    // MCP calls
    if (toolName?.startsWith("mcp__") && e.hookEventName === "PreToolUse") {
      mcpCalls++;
    }

    // Lines added/removed from Edit (old_string → new_string)
    if (toolName === "Edit" && toolInput && e.hookEventName === "PreToolUse") {
      const oldStr = toolInput.old_string as string | undefined;
      const newStr = toolInput.new_string as string | undefined;
      const filePath = toolInput.file_path as string | undefined;
      if (oldStr !== undefined && newStr !== undefined) {
        const oldLines = lineCount(oldStr);
        const newLines = lineCount(newStr);
        if (newLines > oldLines) linesAdded += newLines - oldLines;
        if (oldLines > newLines) linesRemoved += oldLines - newLines;
      }
      if (filePath) modifiedFiles.add(filePath);
    }

    // Lines from Write (entire file content — count as added)
    if (toolName === "Write" && toolInput && e.hookEventName === "PreToolUse") {
      const content = toolInput.content as string | undefined;
      const filePath = toolInput.file_path as string | undefined;
      if (content) linesAdded += lineCount(content);
      if (filePath) modifiedFiles.add(filePath);
    }

    // Lines from MultiEdit
    if (toolName === "MultiEdit" && toolInput && e.hookEventName === "PreToolUse") {
      const edits = toolInput.edits as Array<{ old_string?: string; new_string?: string }> | undefined;
      const filePath = toolInput.file_path as string | undefined;
      if (edits) {
        for (const edit of edits) {
          const oldLines = lineCount(edit.old_string);
          const newLines = lineCount(edit.new_string);
          if (newLines > oldLines) linesAdded += newLines - oldLines;
          if (oldLines > newLines) linesRemoved += oldLines - newLines;
        }
      }
      if (filePath) modifiedFiles.add(filePath);
    }

    // Git operations from Bash commands
    if (toolName === "Bash" && toolInput && e.hookEventName === "PreToolUse") {
      const command = toolInput.command as string | undefined;
      if (command) {
        const gitOp = extractGitOp(command);
        if (gitOp) {
          gitOperations++;
          gitOpsBreakdown[gitOp] = (gitOpsBreakdown[gitOp] ?? 0) + 1;
        }
      }
    }
  }

  const successRate = totalToolCalls > 0
    ? Math.round(((totalToolCalls - failedToolCalls) / totalToolCalls) * 100)
    : 100;

  return {
    linesAdded,
    linesRemoved,
    linesApproximate: true,
    gitOperations,
    gitOpsBreakdown,
    mcpCalls,
    filesModified: modifiedFiles.size,
    modifiedFiles,
    totalToolCalls,
    failedToolCalls,
    successRate,
  };
}
