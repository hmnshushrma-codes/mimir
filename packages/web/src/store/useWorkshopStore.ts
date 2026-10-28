import { create } from "zustand";
import type { SerializedAgent, SerializedProject, SerializedSession, WorkshopEvent } from "@agent-workshop/shared";

export type ConnectionStatus = "connecting" | "live" | "disconnected" | "demo";

export interface TimelineEntry {
  id: number;
  event: WorkshopEvent;
}

interface WorkshopStoreState {
  status: ConnectionStatus;
  projects: Record<string, SerializedProject>;
  sessions: Record<string, SerializedSession>;
  activeSessionId: string | null;
  projectFilter: string | null;
  focusedSessionId: string | null;
  timeline: TimelineEntry[];
  setStatus: (status: ConnectionStatus) => void;
  applySnapshot: (payload: { projects: SerializedProject[]; sessions: SerializedSession[] }) => void;
  applyEvent: (event: WorkshopEvent, project: SerializedProject, agent: SerializedAgent) => void;
  applyAgentUpdate: (sessionId: string, agentId: string, agent: SerializedAgent) => void;
  applySessionUpdate: (sessionId: string, session: SerializedSession) => void;
  setActiveSession: (sessionId: string) => void;
  setProjectFilter: (projectId: string | null) => void;
  setFocusedSession: (sessionId: string | null) => void;
  /** Merges replayed history (from GET /sessions/:id/events) into the
   *  timeline on connect, without touching agent/session state — the
   *  snapshot already carries the correct current state; this just backfills
   *  the event feed for sessions that were already running. */
  backfillTimeline: (events: WorkshopEvent[]) => void;
}

const MAX_TIMELINE_ENTRIES = 500;
let nextTimelineId = 1;

function upsertAgent(session: SerializedSession, agent: SerializedAgent): SerializedSession {
  const agents = session.agents.filter((a) => a.id !== agent.id);
  agents.push(agent);
  return { ...session, agents, lastEventAt: agent.lastEventAt };
}

export const useWorkshopStore = create<WorkshopStoreState>((set, get) => ({
  status: "connecting",
  projects: {},
  sessions: {},
  activeSessionId: null,
  projectFilter: null,
  focusedSessionId: null,
  timeline: [],

  setStatus: (status) => set({ status }),

  applySnapshot: ({ projects, sessions }) => {
    const byProjectId: Record<string, SerializedProject> = {};
    for (const project of projects) byProjectId[project.id] = project;
    const bySessionId: Record<string, SerializedSession> = {};
    for (const session of sessions) bySessionId[session.id] = session;
    const currentActive = get().activeSessionId;
    const activeSessionId = currentActive && bySessionId[currentActive] ? currentActive : (sessions[0]?.id ?? null);
    set({ projects: byProjectId, sessions: bySessionId, activeSessionId });
  },

  applyEvent: (event, project, agent) => {
    set((state) => {
      const existing = state.sessions[event.sessionId] ?? {
        id: event.sessionId,
        projectId: project.id,
        cwd: null,
        branch: null,
        startedAt: event.timestamp,
        lastEventAt: event.timestamp,
        status: "active" as const,
        agents: []
      };
      const session = upsertAgent({ ...existing, projectId: project.id }, agent);
      const timeline = [...state.timeline, { id: nextTimelineId++, event }].slice(-MAX_TIMELINE_ENTRIES);
      return {
        projects: { ...state.projects, [project.id]: project },
        sessions: { ...state.sessions, [session.id]: session },
        activeSessionId: state.activeSessionId ?? session.id,
        timeline
      };
    });
  },

  applyAgentUpdate: (sessionId, _agentId, agent) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return state;
      return { sessions: { ...state.sessions, [sessionId]: upsertAgent(existing, agent) } };
    });
  },

  applySessionUpdate: (sessionId, session) => {
    set((state) => ({ sessions: { ...state.sessions, [sessionId]: session } }));
  },

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setProjectFilter: (projectId) => set({ projectFilter: projectId }),
  setFocusedSession: (sessionId) => set({ focusedSessionId: sessionId }),

  backfillTimeline: (events) => {
    if (events.length === 0) return;
    set((state) => {
      const seen = new Set(state.timeline.map((e) => `${e.event.timestamp}|${e.event.agentId}|${e.event.hookEventName}|${e.event.toolUseId ?? ""}`));
      const additions = events
        .filter((event) => !seen.has(`${event.timestamp}|${event.agentId}|${event.hookEventName}|${event.toolUseId ?? ""}`))
        .map((event) => ({ id: nextTimelineId++, event }));
      if (additions.length === 0) return state;
      const merged = [...additions, ...state.timeline].sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp));
      return { timeline: merged.slice(-MAX_TIMELINE_ENTRIES) };
    });
  }
}));
