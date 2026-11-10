import { WorkshopModel, serializeAgent, serializeProject, serializeSession, type HookEventEnvelope } from "@agent-workshop/shared";
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
      payload = { hook_event_name: "Notification", notification_type: "permission_prompt", message: "Allow this action?" };
      break;
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
