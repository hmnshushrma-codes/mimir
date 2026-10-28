export const DEMO_SESSION_ID = "demo-session";

export interface DemoStep {
  /** Milliseconds from the start of one playthrough. */
  atMs: number;
  payload: Record<string, unknown>;
}

const TU = {
  delegate1: "tu-delegate-1",
  delegate2: "tu-delegate-2",
  delegate3: "tu-delegate-3"
};

/**
 * One main agent, three parallel subagents, a mix of read/edit/bash/web
 * calls, one permission wait, one error, and subagents finishing at
 * different times — per the brief's demo-mode checklist.
 */
export const DEMO_STEPS: DemoStep[] = [
  { atMs: 0, payload: { hook_event_name: "SessionStart", source: "startup", cwd: "/home/demo/agent-workshop" } },
  { atMs: 300, payload: { hook_event_name: "UserPromptSubmit", prompt: "Add dark mode support and audit the auth flow" } },

  { atMs: 800, payload: { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/App.tsx" }, tool_use_id: "tu-1" } },
  { atMs: 1200, payload: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "src/App.tsx" }, tool_output: "...", tool_use_id: "tu-1" } },
  { atMs: 1500, payload: { hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: { pattern: "useTheme" }, tool_use_id: "tu-2" } },
  { atMs: 1800, payload: { hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: { pattern: "useTheme" }, tool_output: "3 matches", tool_use_id: "tu-2" } },

  { atMs: 2200, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Audit the auth flow for vulnerabilities" }, tool_use_id: TU.delegate1 } },
  { atMs: 2300, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Add dark mode CSS variables" }, tool_use_id: TU.delegate2 } },
  { atMs: 2400, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Write unit tests for ThemeProvider" }, tool_use_id: TU.delegate3 } },

  { atMs: 2600, payload: { hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "security-reviewer", task_description: "Audit the auth flow for vulnerabilities" } },
  { atMs: 2700, payload: { hook_event_name: "SubagentStart", agent_id: "agent-2", agent_type: "general-purpose", task_description: "Add dark mode CSS variables" } },
  { atMs: 2800, payload: { hook_event_name: "SubagentStart", agent_id: "agent-3", agent_type: "general-purpose", task_description: "Write unit tests for ThemeProvider" } },

  { atMs: 3200, payload: { hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: { pattern: "password" }, tool_use_id: "tu-3", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 3200, payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/theme.css" }, tool_use_id: "tu-4", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 3300, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test -- ThemeProvider" }, tool_use_id: "tu-5", agent_id: "agent-3", agent_type: "general-purpose" } },

  { atMs: 3600, payload: { hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: { pattern: "password" }, tool_output: "0 matches", tool_use_id: "tu-3", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 3900, payload: { hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "src/theme.css" }, tool_output: "ok", tool_use_id: "tu-4", agent_id: "agent-2", agent_type: "general-purpose" } },

  { atMs: 4000, payload: { hook_event_name: "PreToolUse", tool_name: "WebSearch", tool_input: { query: "OWASP auth best practices 2026" }, tool_use_id: "tu-6", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 4200, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm test -- ThemeProvider" }, tool_output: "4 passed", tool_use_id: "tu-5", agent_id: "agent-3", agent_type: "general-purpose" } },

  { atMs: 4400, payload: { hook_event_name: "Notification", notification_type: "permission_prompt", message: "Edit outside allowed paths needs approval", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 4800, payload: { hook_event_name: "PostToolUse", tool_name: "WebSearch", tool_input: { query: "OWASP auth best practices 2026" }, tool_output: "10 results", tool_use_id: "tu-6", agent_id: "agent-1", agent_type: "security-reviewer" } },

  { atMs: 5200, payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/globals.css" }, tool_use_id: "tu-7", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 5600, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: { file_path: "src/globals.css" }, tool_use_id: "tu-7", error: "ENOENT: no such file", agent_id: "agent-2", agent_type: "general-purpose" } },

  { atMs: 6000, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "src/globals.css" }, tool_use_id: "tu-8", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 6400, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "src/globals.css" }, tool_output: "ok", tool_use_id: "tu-8", agent_id: "agent-2", agent_type: "general-purpose" } },

  { atMs: 6600, payload: { hook_event_name: "SubagentStop", agent_id: "agent-3", agent_type: "general-purpose", exit_reason: "completed", last_assistant_message: "Added 4 tests, all passing." } },
  { atMs: 7200, payload: { hook_event_name: "SubagentStop", agent_id: "agent-2", agent_type: "general-purpose", exit_reason: "completed", last_assistant_message: "Dark mode variables added and tested." } },

  { atMs: 8200, payload: { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/auth/login.ts" }, tool_use_id: "tu-9", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 8600, payload: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "src/auth/login.ts" }, tool_output: "...", tool_use_id: "tu-9", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 9000, payload: { hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "security-reviewer", exit_reason: "completed", last_assistant_message: "No critical vulnerabilities found; two minor recommendations." } },

  { atMs: 9400, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "CHANGELOG.md" }, tool_use_id: "tu-10" } },
  { atMs: 9800, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "CHANGELOG.md" }, tool_output: "ok", tool_use_id: "tu-10" } },
  { atMs: 10200, payload: { hook_event_name: "Stop", last_assistant_message: "Dark mode added, auth flow audited, tests passing." } }
];

export const DEMO_LOOP_GAP_MS = 4000;
export const DEMO_TOTAL_DURATION_MS = DEMO_STEPS[DEMO_STEPS.length - 1].atMs + DEMO_LOOP_GAP_MS;
