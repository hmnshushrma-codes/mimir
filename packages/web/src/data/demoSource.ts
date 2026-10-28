import { WorkshopModel, serializeAgent, serializeProject, serializeSession, type HookEventEnvelope } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { DEMO_STEPS, DEMO_TOTAL_DURATION_MS } from "./demoScenario.js";

const SWEEP_INTERVAL_MS = 500;
const DEPART_AFTER_MS = 4000;
const IDLE_MS = 6000;
const STALE_MS = 60_000;
const SESSION_IDLE_MS = 30_000;
const SESSION_ENDED_MS = 120_000;
// Real deployments default to 15s; the demo uses a much shorter threshold so
// the "concentrating" mood is actually reachable within a short loop — see
// demoScenario.ts's s1-a1-long step, which runs ~6.4s.
const DEMO_LONG_TOOL_CALL_MS = 4000;

/**
 * Plays the scripted multi-session demo event stream through the exact same
 * WorkshopModel.ingest() path the real collector server uses — demo mode
 * exercises the real normalizer, state machine, and mood derivation, not a
 * UI-only mock. One model instance serves all 3 demo sessions, exactly as
 * the real collector serves all real sessions.
 */
export function connectDemoSource(): () => void {
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
    const model = new WorkshopModel(DEMO_LONG_TOOL_CALL_MS);

    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = setInterval(() => {
      const now = new Date().toISOString();
      const agentTouched = [
        ...model.sweepPresence(now, IDLE_MS, STALE_MS),
        ...model.sweepDepartures(now, DEPART_AFTER_MS),
        ...model.sweepMoods(now)
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

    for (const step of DEMO_STEPS) {
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
    }, DEMO_TOTAL_DURATION_MS);
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
  if (import.meta.env.MODE === "demo") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}
