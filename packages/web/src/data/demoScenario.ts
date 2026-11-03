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
 * repo on different branches), 9 total agents, and every display state
 * represented at least once:
 *   - thinking / awaiting_prompt / sleeping: ordinary tool-call / idle
 *     cycling, all sessions
 *   - working: every delegate PreToolUse (S1, S2, S3 all delegate twice),
 *     plus every ordinary tool call
 *   - needs_permission: S2 agent-2 hits a permission prompt
 *   - error: S1 agent-2's single tool failure, S3 agent-1's three
 *     consecutive tool failures
 *   - done: every SubagentStop
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

// ─── Stress scenario (?demo=1&stress=1) — performance measurement only ───

const STRESS_SESSION_COUNT = 4;
const STRESS_SUBAGENTS_PER_SESSION = 5; // 20 total — under DeskArea's MAX_VISIBLE_WORKERS(6)/session cap
const STRESS_CYCLE_MS = 2000;
const STRESS_SPAWN_END_MS = 1000; // all 20 subagents are spawned by this point
// Two burst windows with a genuinely quiet gap between them, all 20
// subagents already on screen throughout — the gap is the "idle" fps/cpu
// measurement (idle blink/breathing only, no incoming events); either burst
// window is the "busy" measurement (sustained staggered tool-call churn).
const STRESS_BURST_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [STRESS_SPAWN_END_MS, 13_000],
  [18_000, 30_000]
];
const STRESS_TOOL_NAMES = ["Bash", "Write", "Read", "Grep"] as const;

/**
 * Generated (not hand-authored) scenario that replays the real ingest path
 * exactly like DEMO_STEPS, just at a scale (20 subagents across 4 sessions)
 * the curated narrative above was never meant to cover. Every subagent
 * repeatedly opens and closes a tool call on its own phase-offset cycle
 * within each burst window, so no two agents start in lockstep — the point
 * is sustained, staggered "busy" animation for fps/cpu measurement (plus a
 * clean "idle" gap between bursts), not a readable story.
 */
function generateStressSteps(): DemoStep[] {
  const steps: DemoStep[] = [];

  for (let s = 0; s < STRESS_SESSION_COUNT; s++) {
    const sessionId = `stress-s${s}`;
    const project: ProjectInfo = s % 2 === 0
      ? { ...DEMO_PROJECTS.workshop, id: `demo-proj-stress-${s}`, branch: `stress-${s}` }
      : { ...DEMO_PROJECTS.marketing, id: `demo-proj-stress-${s}`, branch: `stress-${s}` };

    steps.push({ atMs: s * 50, sessionId, project, payload: { hook_event_name: "SessionStart", source: "startup", cwd: project.rootPath } });
    steps.push({ atMs: s * 50 + 100, sessionId, project, payload: { hook_event_name: "UserPromptSubmit", prompt: `Stress-test batch ${s + 1}` } });

    for (let a = 0; a < STRESS_SUBAGENTS_PER_SESSION; a++) {
      const agentId = `agent-${a + 1}`;
      const agentType = "general-purpose";
      const spawnAt = 300 + s * 50 + a * 40;
      steps.push({
        atMs: spawnAt,
        sessionId,
        project,
        payload: { hook_event_name: "SubagentStart", agent_id: agentId, agent_type: agentType, task_description: `Stress task ${s + 1}.${a + 1}` }
      });

      let cycleIndex = 0;
      for (const [windowStart, windowEnd] of STRESS_BURST_WINDOWS) {
        // Stagger each agent's cycle phase so bursts don't land in lockstep.
        const phaseOffsetMs = (a * 311 + s * 137) % STRESS_CYCLE_MS;
        let t = windowStart + phaseOffsetMs;
        while (t < windowEnd) {
          const toolName = STRESS_TOOL_NAMES[(a + cycleIndex) % STRESS_TOOL_NAMES.length];
          const toolUseId = `${sessionId}-${agentId}-${cycleIndex}`;
          steps.push({
            atMs: t,
            sessionId,
            project,
            payload: { hook_event_name: "PreToolUse", tool_name: toolName, tool_input: {}, tool_use_id: toolUseId, agent_id: agentId, agent_type: agentType }
          });
          steps.push({
            atMs: Math.min(t + STRESS_CYCLE_MS * 0.6, windowEnd - 50),
            sessionId,
            project,
            payload: { hook_event_name: "PostToolUse", tool_name: toolName, tool_input: {}, tool_output: "ok", tool_use_id: toolUseId, agent_id: agentId, agent_type: agentType }
          });
          t += STRESS_CYCLE_MS;
          cycleIndex++;
        }
      }

      const lastWindowEnd = STRESS_BURST_WINDOWS[STRESS_BURST_WINDOWS.length - 1][1];
      steps.push({
        atMs: lastWindowEnd + 500 + a * 30,
        sessionId,
        project,
        payload: { hook_event_name: "SubagentStop", agent_id: agentId, agent_type: agentType, exit_reason: "completed", last_assistant_message: "Stress task complete." }
      });
    }

    const lastWindowEnd = STRESS_BURST_WINDOWS[STRESS_BURST_WINDOWS.length - 1][1];
    steps.push({
      atMs: lastWindowEnd + 1000,
      sessionId,
      project,
      payload: { hook_event_name: "Stop", last_assistant_message: "Stress batch complete." }
    });
  }

  return steps.sort((a, b) => a.atMs - b.atMs);
}

export const STRESS_STEPS: DemoStep[] = generateStressSteps();
export const STRESS_LOOP_GAP_MS = DEMO_LOOP_GAP_MS;
export const STRESS_TOTAL_DURATION_MS = Math.max(...STRESS_STEPS.map((s) => s.atMs)) + STRESS_LOOP_GAP_MS;
