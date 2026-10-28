export const ACTION_CATEGORIES = [
  "read",
  "write",
  "shell",
  "web",
  "delegate",
  "mcp",
  "other"
] as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

const TOOL_CATEGORY: Record<string, ActionCategory> = {
  Read: "read",
  Grep: "read",
  Glob: "read",
  LS: "read",
  Edit: "write",
  Write: "write",
  MultiEdit: "write",
  NotebookEdit: "write",
  Bash: "shell",
  WebSearch: "web",
  WebFetch: "web",
  Task: "delegate",
  Agent: "delegate"
};

export function categorizeTool(toolName: string | null | undefined): ActionCategory {
  if (!toolName) return "other";
  if (toolName in TOOL_CATEGORY) return TOOL_CATEGORY[toolName];
  if (toolName.startsWith("mcp__")) return "mcp";
  return "other";
}
