import type { ProjectInfo } from "@agent-workshop/shared";

export const DEMO_PROJECTS: Record<string, ProjectInfo> = {
  workshop: {
    id: "demo-proj-workshop",
    name: "agent-workshop",
    rootPath: "/home/demo/agent-workshop",
    worktreeOf: null,
    branch: "main"
  },
  marketing: {
    id: "demo-proj-marketing",
    name: "marketing-site",
    rootPath: "/home/demo/marketing-site",
    worktreeOf: null,
    branch: "redesign"
  }
};

export interface DemoStep {
  atMs: number;
  sessionId: string;
  project: ProjectInfo;
  payload: Record<string, unknown>;
}

const S1 = "demo-s1"; // project workshop, branch main
const S2 = "demo-s2"; // project workshop too — second session, same repo, different branch
const S3 = "demo-s3"; // project marketing

const workshopMain = DEMO_PROJECTS.workshop;
const workshopFeature: ProjectInfo = { ...DEMO_PROJECTS.workshop, branch: "feature-dark-mode" };
const marketing = DEMO_PROJECTS.marketing;

/**
 * 3 sessions across 2 projects (two sessions share the "agent-workshop"
 * repo on different branches), 9 total agents, and every mood from
 * mood.ts represented at least once:
 *   - focused / sleepy: ordinary tool-call / idle cycling, all sessions
 *   - excited: each delegate PreToolUse (S1, S2, S3 all delegate twice)
 *   - concentrating: S1 agent-1's long-running tool call (demo uses a short
 *     longToolCallMs so this shows up quickly — see demoSource.ts)
 *   - worried: S2 agent-2 hits a permission prompt
 *   - dizzy: S1 agent-2's single tool failure
 *   - frustrated: S3 agent-1's three consecutive tool failures
 *   - proud: every SubagentStop
 *   - neutral: implicit in SessionStart/entering and post-DEPART/leaving
 */
export const DEMO_STEPS: DemoStep[] = [
  // --- Session starts, interleaved ---
  { atMs: 0, sessionId: S1, project: workshopMain, payload: { hook_event_name: "SessionStart", source: "startup", cwd: workshopMain.rootPath } },
  { atMs: 150, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "SessionStart", source: "startup", cwd: workshopFeature.rootPath } },
  { atMs: 300, sessionId: S3, project: marketing, payload: { hook_event_name: "SessionStart", source: "startup", cwd: marketing.rootPath } },

  { atMs: 500, sessionId: S1, project: workshopMain, payload: { hook_event_name: "UserPromptSubmit", prompt: "Audit the auth flow and add dark mode" } },
  { atMs: 600, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "UserPromptSubmit", prompt: "Refactor the theme provider for the dark-mode branch" } },
  { atMs: 700, sessionId: S3, project: marketing, payload: { hook_event_name: "UserPromptSubmit", prompt: "Fix the flaky deploy script" } },

  // --- S1: main does a quick read, then delegates two subagents ---
  { atMs: 1000, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/App.tsx" }, tool_use_id: "s1-tu1" } },
  { atMs: 1400, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_output: "...", tool_use_id: "s1-tu1" } },
  { atMs: 1800, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Audit the auth flow" }, tool_use_id: "s1-delegate-1" } },
  { atMs: 1900, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Scaffold dark mode CSS variables" }, tool_use_id: "s1-delegate-2" } },
  { atMs: 2200, sessionId: S1, project: workshopMain, payload: { hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "security-reviewer", task_description: "Audit the auth flow" } },
  { atMs: 2300, sessionId: S1, project: workshopMain, payload: { hook_event_name: "SubagentStart", agent_id: "agent-2", agent_type: "general-purpose", task_description: "Scaffold dark mode CSS variables" } },

  // S1 agent-1: a long-running tool call (-> concentrating once it crosses the demo threshold)
  { atMs: 2600, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Grep", tool_input: { pattern: "password" }, tool_use_id: "s1-a1-long", agent_id: "agent-1", agent_type: "security-reviewer" } },
  { atMs: 9000, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: {}, tool_output: "0 matches", tool_use_id: "s1-a1-long", agent_id: "agent-1", agent_type: "security-reviewer" } },

  // S1 agent-2: one failure (-> dizzy), then success, then finishes
  { atMs: 2800, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/theme.css" }, tool_use_id: "s1-a2-t1", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 3300, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: { file_path: "src/theme.css" }, tool_use_id: "s1-a2-t1", error: "ENOENT", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 4000, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "src/theme.css" }, tool_use_id: "s1-a2-t2", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 4500, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "s1-a2-t2", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 5200, sessionId: S1, project: workshopMain, payload: { hook_event_name: "SubagentStop", agent_id: "agent-2", agent_type: "general-purpose", exit_reason: "completed", last_assistant_message: "Dark mode variables added." } },
  { atMs: 9500, sessionId: S1, project: workshopMain, payload: { hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "security-reviewer", exit_reason: "completed", last_assistant_message: "No critical issues found." } },

  // --- S2: main delegates two subagents; agent-2 hits a permission prompt (-> worried) ---
  { atMs: 1800, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Write ThemeProvider tests" }, tool_use_id: "s2-delegate-1" } },
  { atMs: 1900, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Update the CSS build pipeline" }, tool_use_id: "s2-delegate-2" } },
  { atMs: 2200, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Plan", task_description: "Write ThemeProvider tests" } },
  { atMs: 2300, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "SubagentStart", agent_id: "agent-2", agent_type: "general-purpose", task_description: "Update the CSS build pipeline" } },

  { atMs: 2700, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test -- ThemeProvider" }, tool_use_id: "s2-a1-t1", agent_id: "agent-1", agent_type: "Plan" } },
  { atMs: 3400, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "4 passed", tool_use_id: "s2-a1-t1", agent_id: "agent-1", agent_type: "Plan" } },
  { atMs: 7000, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "Plan", exit_reason: "completed", last_assistant_message: "4 tests added, all passing." } },

  { atMs: 3000, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "Notification", notification_type: "permission_prompt", message: "Edit outside allowed paths needs approval", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 5500, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "webpack.config.js" }, tool_use_id: "s2-a2-t1", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 6200, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: {}, tool_output: "ok", tool_use_id: "s2-a2-t1", agent_id: "agent-2", agent_type: "general-purpose" } },
  { atMs: 8500, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "SubagentStop", agent_id: "agent-2", agent_type: "general-purpose", exit_reason: "completed", last_assistant_message: "Build pipeline updated." } },

  // --- S3: main delegates two subagents; agent-1 fails 3x in a row (-> frustrated), then recovers ---
  { atMs: 1800, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Fix the deploy script" }, tool_use_id: "s3-delegate-1" } },
  { atMs: 1900, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Check CDN cache headers" }, tool_use_id: "s3-delegate-2" } },
  { atMs: 2200, sessionId: S3, project: marketing, payload: { hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "devops-bot", task_description: "Fix the deploy script" } },
  { atMs: 2300, sessionId: S3, project: marketing, payload: { hook_event_name: "SubagentStart", agent_id: "agent-2", agent_type: "Explore", task_description: "Check CDN cache headers" } },

  { atMs: 2600, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "./deploy.sh" }, tool_use_id: "s3-a1-t1", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 3000, sessionId: S3, project: marketing, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: "s3-a1-t1", error: "exit 1", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 3300, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "./deploy.sh --retry" }, tool_use_id: "s3-a1-t2", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 3700, sessionId: S3, project: marketing, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: "s3-a1-t2", error: "exit 1", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 4000, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "./deploy.sh --retry" }, tool_use_id: "s3-a1-t3", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 4400, sessionId: S3, project: marketing, payload: { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: "s3-a1-t3", error: "exit 1", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 7500, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "./deploy.sh --verbose" }, tool_use_id: "s3-a1-t4", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 8200, sessionId: S3, project: marketing, payload: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "deployed", tool_use_id: "s3-a1-t4", agent_id: "agent-1", agent_type: "devops-bot" } },
  { atMs: 9000, sessionId: S3, project: marketing, payload: { hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "devops-bot", exit_reason: "completed", last_assistant_message: "Deploy script fixed after retry." } },

  { atMs: 2700, sessionId: S3, project: marketing, payload: { hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url: "https://cdn.example.com" }, tool_use_id: "s3-a2-t1", agent_id: "agent-2", agent_type: "Explore" } },
  { atMs: 3400, sessionId: S3, project: marketing, payload: { hook_event_name: "PostToolUse", tool_name: "WebFetch", tool_input: {}, tool_output: "cache-control: max-age=0", tool_use_id: "s3-a2-t1", agent_id: "agent-2", agent_type: "Explore" } },
  { atMs: 7000, sessionId: S3, project: marketing, payload: { hook_event_name: "SubagentStop", agent_id: "agent-2", agent_type: "Explore", exit_reason: "completed", last_assistant_message: "Cache headers look correct." } },

  // --- wrap up ---
  { atMs: 11000, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "CHANGELOG.md" }, tool_use_id: "s1-tu2" } },
  { atMs: 11500, sessionId: S1, project: workshopMain, payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_output: "ok", tool_use_id: "s1-tu2" } },
  { atMs: 12000, sessionId: S1, project: workshopMain, payload: { hook_event_name: "Stop", last_assistant_message: "Auth audited, dark mode scaffolded." } },
  { atMs: 9000, sessionId: S2, project: workshopFeature, payload: { hook_event_name: "Stop", last_assistant_message: "Theme provider refactored, tests passing." } },
  { atMs: 9800, sessionId: S3, project: marketing, payload: { hook_event_name: "Stop", last_assistant_message: "Deploy fixed, cache headers verified." } }
];

export const DEMO_LOOP_GAP_MS = 6000;
export const DEMO_TOTAL_DURATION_MS = Math.max(...DEMO_STEPS.map((s) => s.atMs)) + DEMO_LOOP_GAP_MS;
