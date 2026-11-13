import { WorkshopModel, serializeAgent, serializeProject, serializeSession, classifyRisk, type HookEventEnvelope, type PermissionRequestPayload } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { DEMO_STEPS, DEMO_TOTAL_DURATION_MS, STRESS_STEPS, STRESS_TOTAL_DURATION_MS } from "./demoScenario.js";
import { PUBLIC_DEMO_STEPS, PUBLIC_DEMO_TOTAL_MS } from "./publicDemoScript.js";

const SWEEP_INTERVAL_MS = 500;
const DEPART_AFTER_MS = 4000;
const IDLE_MS = 6000;
const STALE_MS = 60_000;
const SESSION_IDLE_MS = 30_000;
const SESSION_ENDED_MS = 120_000;

/**
 * Plays the scripted multi-session demo event stream through the exact same
 * WorkshopModel.ingest() path the real collector server uses — demo mode
 * exercises the real normalizer and state machine, not a UI-only mock. One
 * model instance serves all 3 demo sessions, exactly as the real collector
 * serves all real sessions.
 */
function isStressMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("stress") === "1";
}

function isPublicDemo(): boolean {
  return import.meta.env.VITE_DEMO === "true";
}

/** Global model reference for the demo control bar to inject events. */
let activeModel: WorkshopModel | null = null;
let activeSessionId: string | null = null;
let triggerCounter = 0;

/** Inject a manual event from the control bar. */
export function triggerDemoEvent(type: string): void {
  if (!activeModel || !activeSessionId) return;
  const now = new Date().toISOString();
  const id = `trigger-${++triggerCounter}`;
  const project = isPublicDemo()
    ? PUBLIC_DEMO_STEPS[0].project
    : DEMO_STEPS[0].project;

  let payload: Record<string, unknown>;
  switch (type) {
    case "permission":
    case "perm_bash":
    case "perm_edit":
    case "perm_force_push": {
      // Specific permission scenarios
      const scenarios: Record<string, { tool: string; input: Record<string, unknown>; msg: string }> = {
        permission: { tool: "Bash", input: { command: "npm run deploy:staging" }, msg: "Run deploy to staging?" },
        perm_bash: { tool: "Bash", input: { command: "rm -rf dist/ && npm run build" }, msg: "Delete dist and rebuild?" },
        perm_edit: { tool: "Write", input: { file_path: "/home/user/project/src/config.ts" }, msg: "Write to config.ts?" },
        perm_force_push: { tool: "Bash", input: { command: "git push --force origin main" }, msg: "Force push to main?" },
      };
      const s = scenarios[type] ?? scenarios.permission;

      // Fire PreToolUse first (so mascot enters needs_permission after Notification)
      const prePayload = { hook_event_name: "PreToolUse", tool_name: s.tool, tool_input: s.input, tool_use_id: `perm-tool-${id}` };
      {
        const preEnv = { ...prePayload, session_id: activeSessionId, timestamp: now } as HookEventEnvelope;
        const r = activeModel.ingest(preEnv, project);
        useWorkshopStore.getState().applyEvent(r.workshopEvent, serializeProject(r.project), serializeAgent(r.agent));
      }

      // Now the Notification
      payload = { hook_event_name: "Notification", notification_type: "permission_prompt", message: s.msg };

      // Also fire the enriched permission into the store (no server in demo)
      const detail = typeof s.input.command === "string" ? s.input.command : (typeof s.input.file_path === "string" ? s.input.file_path : null);
      const permPayload: PermissionRequestPayload = {
        id: `perm-${activeSessionId}-main-${now}`,
        sessionId: activeSessionId!,
        agentId: "main",
        agentName: "main",
        projectName: typeof project === "string" ? project : (project as { name?: string }).name ?? "demo",
        branch: "main",
        toolName: s.tool,
        detail,
        message: s.msg,
        risk: detail ? classifyRisk(detail) : null,
        requestedAt: now,
        hookConnected: true, // Demo mode simulates Phase B
      };
      // Defer so the model event processes first
      setTimeout(() => useWorkshopStore.getState().addPermissionRequest(permPayload), 10);
      break;
    }
    case "spawn":
      payload = { hook_event_name: "SubagentStart", agent_id: `demo-agent-${id}`, agent_type: "general-purpose", task_description: `Triggered task ${id}` };
      break;
    case "error":
      payload = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: `err-pre-${id}` };
      // Fire the pre, then immediately fire a failure
      {
        const env1 = { ...payload, session_id: activeSessionId, timestamp: now } as HookEventEnvelope;
        const r1 = activeModel.ingest(env1, project);
        useWorkshopStore.getState().applyEvent(r1.workshopEvent, serializeProject(r1.project), serializeAgent(r1.agent));
      }
      payload = { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "exit 1", tool_use_id: `err-pre-${id}` };
      break;
    case "finish":
      payload = { hook_event_name: "Stop", last_assistant_message: "All done!" };
      // Dismiss any pending permissions for this session
      setTimeout(() => {
        const store = useWorkshopStore.getState();
        for (const p of store.pendingPermissions) {
          if (p.sessionId === activeSessionId) store.resolvePermission(p.id);
        }
      }, 10);
      break;
    case "end_session":
      payload = { hook_event_name: "SessionEnd", reason: "prompt_input_exit" };
      // Dismiss any pending permissions for this session
      setTimeout(() => {
        const store = useWorkshopStore.getState();
        for (const p of store.pendingPermissions) {
          if (p.sessionId === activeSessionId) store.resolvePermission(p.id);
        }
      }, 10);
      break;
    default:
      return;
  }

  const envelope = { ...payload, session_id: activeSessionId, timestamp: now } as HookEventEnvelope;
  const { workshopEvent, project: proj, agent } = activeModel.ingest(envelope, project);
  useWorkshopStore.getState().applyEvent(workshopEvent, serializeProject(proj), serializeAgent(agent));
}

export function connectDemoSource(): () => void {
  const publicDemo = isPublicDemo();
  const stress = isStressMode();
  const steps = publicDemo ? PUBLIC_DEMO_STEPS : (stress ? STRESS_STEPS : DEMO_STEPS);
  const totalDurationMs = publicDemo ? PUBLIC_DEMO_TOTAL_MS : (stress ? STRESS_TOTAL_DURATION_MS : DEMO_TOTAL_DURATION_MS);

  const timers: ReturnType<typeof setTimeout>[] = [];
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let loopCount = 0;

  useWorkshopStore.getState().setStatus("demo");
  useWorkshopStore.getState().applySnapshot({ projects: [], sessions: [] });

  function playOnce() {
    if (stopped) return;
    loopCount += 1;
    const sessionSuffix = `-l${loopCount}`;
    const model = new WorkshopModel();
    activeModel = model;
    activeSessionId = `${steps[0]?.sessionId ?? "demo"}${sessionSuffix}`;

    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = setInterval(() => {
      const now = new Date().toISOString();
      const agentTouched = [
        ...model.sweepPresence(now, IDLE_MS, STALE_MS),
        ...model.sweepDepartures(now, DEPART_AFTER_MS),
        ...model.sweepDisplayStates(now)
      ];
      const deduped = new Map(agentTouched.map((t) => [`${t.sessionId}:${t.agentId}`, t]));
      for (const { sessionId, agentId } of deduped.values()) {
        const agent = model.getSession(sessionId)?.agents.get(agentId);
        if (agent) useWorkshopStore.getState().applyAgentUpdate(sessionId, agentId, serializeAgent(agent));
      }

      const sessionTouched = model.sweepSessionStatus(now, SESSION_IDLE_MS, SESSION_ENDED_MS);
      for (const { sessionId } of sessionTouched) {
        const session = model.getSession(sessionId);
        if (session) useWorkshopStore.getState().applySessionUpdate(sessionId, serializeSession(session));
      }
    }, SWEEP_INTERVAL_MS);

    for (const step of steps) {
      const timer = setTimeout(() => {
        const envelope = {
          ...step.payload,
          session_id: `${step.sessionId}${sessionSuffix}`,
          timestamp: new Date().toISOString()
        } as HookEventEnvelope;
        const { workshopEvent, project, agent } = model.ingest(envelope, step.project);
        useWorkshopStore.getState().applyEvent(workshopEvent, serializeProject(project), serializeAgent(agent));
      }, step.atMs);
      timers.push(timer);
    }

    const loopTimer = setTimeout(() => {
      useWorkshopStore.getState().applySnapshot({ projects: [], sessions: [] });
      playOnce();
    }, totalDurationMs);
    timers.push(loopTimer);
  }

  playOnce();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    if (sweepTimer) clearInterval(sweepTimer);
  };
}

export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO === "true") return true;
  if (import.meta.env.MODE === "demo") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}
