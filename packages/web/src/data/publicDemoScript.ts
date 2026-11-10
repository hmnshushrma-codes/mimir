/**
 * Public demo script — a 75-second looping scenario for the static deploy.
 * Uses ONLY fake data: no real project names, paths, user names, costs, or tokens.
 *
 * Sequence:
 *  0s  - Session start + user prompt
 *  2s  - Foreman thinks (thinking state)
 *  4s  - Foreman reads files
 *  8s  - Foreman starts typing (write)
 * 12s  - Foreman delegates 3 subagents
 * 15s  - Subagents spawn and start working
 * 25s  - Error on subagent-2 (oops + retry)
 * 35s  - Permission request on subagent-3 (raise hand, YES/NO)
 * 45s  - Subagents finish one by one
 * 55s  - Foreman wraps up
 * 60s  - Celebrate (done)
 * 65s  - Idle / sleeping
 * 75s  - Loop
 */

import type { ProjectInfo } from "@agent-workshop/shared";
import type { DemoStep } from "./demoScenario.js";

const PROJECT: ProjectInfo = {
  id: "demo-proj-acme",
  name: "acme-app",
  rootPath: "/workspace/acme-app",
  worktreeOf: null,
  branch: "feature/dashboard",
};

const S = "public-demo";

export const PUBLIC_DEMO_STEPS: DemoStep[] = [
  // --- Session start + prompt ---
  { atMs: 0, sessionId: S, project: PROJECT, payload: { hook_event_name: "SessionStart", source: "startup", cwd: PROJECT.rootPath } },
  { atMs: 500, sessionId: S, project: PROJECT, payload: { hook_event_name: "UserPromptSubmit", prompt: "Build the analytics dashboard with charts and filters" } },

  // --- Thinking ---
  // (no tool call = thinking state, driven by the prompt submit with no immediate PreToolUse)

  // --- Reading files ---
  { atMs: 3000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/components/Dashboard.tsx" }, tool_use_id: "tu-read1" } },
  { atMs: 4500, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "tu-read1" } },
  { atMs: 5000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: { pattern: "ChartComponent" }, tool_use_id: "tu-grep1" } },
  { atMs: 6000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: {}, tool_output: "3 matches", tool_use_id: "tu-grep1" } },

  // --- Typing (write) ---
  { atMs: 7000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "src/components/AnalyticsView.tsx" }, tool_use_id: "tu-write1" } },
  { atMs: 9000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "tu-write1" } },

  // --- Bash ---
  { atMs: 10000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm run typecheck" }, tool_use_id: "tu-bash1" } },
  { atMs: 12000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "0 errors", tool_use_id: "tu-bash1" } },

  // --- Delegate 3 subagents ---
  { atMs: 13000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Build the chart components" }, tool_use_id: "tu-del1" } },
  { atMs: 13500, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Add filter controls" }, tool_use_id: "tu-del2" } },
  { atMs: 14000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Write integration tests" }, tool_use_id: "tu-del3" } },

  // --- Subagents spawn ---
  { atMs: 15000, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStart", agent_id: "scout-1", agent_type: "Explore", task_description: "Build chart components" } },
  { atMs: 15100, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_output: "started", tool_use_id: "tu-del1" } },
  { atMs: 15500, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStart", agent_id: "builder-1", agent_type: "general-purpose", task_description: "Add filter controls" } },
  { atMs: 15600, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_output: "started", tool_use_id: "tu-del2" } },
  { atMs: 16000, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStart", agent_id: "tester-1", agent_type: "Plan", task_description: "Write integration tests" } },
  { atMs: 16100, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_output: "started", tool_use_id: "tu-del3" } },

  // --- Subagent-1 works (reads + writes) ---
  { atMs: 17000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/charts/BarChart.tsx" }, tool_use_id: "s1-r1", agent_id: "scout-1", agent_type: "Explore" } },
  { atMs: 18500, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "s1-r1", agent_id: "scout-1", agent_type: "Explore" } },
  { atMs: 19000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "src/charts/LineChart.tsx" }, tool_use_id: "s1-w1", agent_id: "scout-1", agent_type: "Explore" } },
  { atMs: 22000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "s1-w1", agent_id: "scout-1", agent_type: "Explore" } },

  // --- Subagent-2 works then ERRORS (oops + retry) ---
  { atMs: 17500, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/components/Filters.tsx" }, tool_use_id: "s2-e1", agent_id: "builder-1", agent_type: "general-purpose" } },
  { atMs: 20000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: {}, error: "ENOENT: file not found", tool_use_id: "s2-e1", agent_id: "builder-1", agent_type: "general-purpose" } },
  // Retry
  { atMs: 22000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "src/components/Filters.tsx" }, tool_use_id: "s2-w1", agent_id: "builder-1", agent_type: "general-purpose" } },
  { atMs: 25000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "s2-w1", agent_id: "builder-1", agent_type: "general-purpose" } },

  // --- Subagent-3 works then hits PERMISSION (raise hand) ---
  { atMs: 18000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test -- integration" }, tool_use_id: "s3-b1", agent_id: "tester-1", agent_type: "Plan" } },
  { atMs: 22000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "5 passed", tool_use_id: "s3-b1", agent_id: "tester-1", agent_type: "Plan" } },
  { atMs: 24000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm run deploy:staging" }, tool_use_id: "s3-b2", agent_id: "tester-1", agent_type: "Plan" } },
  { atMs: 25000, sessionId: S, project: PROJECT, payload: { hook_event_name: "Notification", notification_type: "permission_prompt", message: "Run deploy to staging?", agent_id: "tester-1", agent_type: "Plan" } },
  // Permission resolved after 10s
  { atMs: 35000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "deployed", tool_use_id: "s3-b2", agent_id: "tester-1", agent_type: "Plan" } },

  // --- Subagents finish ---
  { atMs: 40000, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStop", agent_id: "scout-1", agent_type: "Explore", exit_reason: "completed", last_assistant_message: "Charts built." } },
  { atMs: 43000, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStop", agent_id: "builder-1", agent_type: "general-purpose", exit_reason: "completed", last_assistant_message: "Filters added." } },
  { atMs: 47000, sessionId: S, project: PROJECT, payload: { hook_event_name: "SubagentStop", agent_id: "tester-1", agent_type: "Plan", exit_reason: "completed", last_assistant_message: "Tests passing, staging deployed." } },

  // --- Foreman wraps up ---
  { atMs: 50000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "CHANGELOG.md" }, tool_use_id: "tu-final" } },
  { atMs: 53000, sessionId: S, project: PROJECT, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "tu-final" } },

  // --- Celebrate ---
  { atMs: 55000, sessionId: S, project: PROJECT, payload: { hook_event_name: "Stop", last_assistant_message: "Dashboard built with charts, filters, and tests. Deployed to staging." } },
];

export const PUBLIC_DEMO_LOOP_GAP_MS = 15000; // 15s gap before loop
export const PUBLIC_DEMO_TOTAL_MS = Math.max(...PUBLIC_DEMO_STEPS.map((s) => s.atMs)) + PUBLIC_DEMO_LOOP_GAP_MS;
