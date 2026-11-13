import { create } from "zustand";
import type { SerializedAgent, SerializedProject, SerializedSession, WorkshopEvent, PermissionRequestPayload } from "@agent-workshop/shared";

export type ConnectionStatus = "connecting" | "live" | "disconnected" | "demo";

const DEBUG_OVERLAY_STORAGE_KEY = "mimir:debug-overlay:v1";

function loadDebugOverlayEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_OVERLAY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveDebugOverlayEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_OVERLAY_STORAGE_KEY, String(enabled));
  } catch {
    // ignore — e.g. localStorage unavailable
  }
}

export interface TimelineEntry {
  id: number;
  event: WorkshopEvent;
}

export interface PromptEntry {
  text: string;
  timestamp: string;
}

/** Per-session prompt history (most recent first, max 5 per session). */
export type PromptHistory = Map<string, PromptEntry[]>;

const MAX_PROMPT_HISTORY = 5;

interface WorkshopStoreState {
  status: ConnectionStatus;
  projects: Record<string, SerializedProject>;
  sessions: Record<string, SerializedSession>;
  activeSessionId: string | null;
  projectFilter: string | null;
  focusedSessionId: string | null;
  timeline: TimelineEntry[];
  /** Dedicated prompt history — never lost when timeline trims */
  promptHistory: Record<string, PromptEntry[]>;
  /** Pending permission requests (queue, ordered by time) */
  pendingPermissions: PermissionRequestPayload[];
  /** Brief resolved messages: id → "Allowed from dashboard" etc. Auto-clears. */
  resolvedMessages: Record<string, string>;
  /** Whether remote approval is connected (hook is installed and server has token). */
  remoteApprovalConnected: boolean;
  debugOverlayEnabled: boolean;
  setStatus: (status: ConnectionStatus) => void;
  applySnapshot: (payload: { projects: SerializedProject[]; sessions: SerializedSession[] }) => void;
  applyEvent: (event: WorkshopEvent, project: SerializedProject, agent: SerializedAgent) => void;
  applyAgentUpdate: (sessionId: string, agentId: string, agent: SerializedAgent) => void;
  applySessionUpdate: (sessionId: string, session: SerializedSession) => void;
  setActiveSession: (sessionId: string) => void;
  setProjectFilter: (projectId: string | null) => void;
  setFocusedSession: (sessionId: string | null) => void;
  toggleDebugOverlay: () => void;
  /** Merges replayed history (from GET /sessions/:id/events) into the
   *  timeline on connect, without touching agent/session state — the
   *  snapshot already carries the correct current state; this just backfills
   *  the event feed for sessions that were already running. */
  backfillTimeline: (events: WorkshopEvent[]) => void;
  addPermissionRequest: (perm: PermissionRequestPayload) => void;
  resolvePermission: (id: string, message?: string) => void;
  setRemoteApproval: (connected: boolean) => void;
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
  promptHistory: {},
  pendingPermissions: [],
  resolvedMessages: {},
  remoteApprovalConnected: false,
  debugOverlayEnabled: loadDebugOverlayEnabled(),

  setStatus: (status) => set({ status }),

  applySnapshot: ({ projects, sessions }) => {
    const byProjectId: Record<string, SerializedProject> = {};
    for (const project of projects) byProjectId[project.id] = project;
    const bySessionId: Record<string, SerializedSession> = {};
    for (const session of sessions) bySessionId[session.id] = session;
    const currentActive = get().activeSessionId;
    const activeSessionId = currentActive && bySessionId[currentActive] ? currentActive : (sessions[0]?.id ?? null);
    set({ projects: byProjectId, sessions: bySessionId, activeSessionId, promptHistory: {} });
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

      // Track prompts in a dedicated field so they survive timeline trimming
      let promptHistory = state.promptHistory;
      if (event.hookEventName === "UserPromptSubmit" && event.target) {
        const sid = event.sessionId;
        const prev = state.promptHistory[sid] ?? [];
        const entry: PromptEntry = { text: event.target, timestamp: event.timestamp };
        promptHistory = { ...state.promptHistory, [sid]: [entry, ...prev].slice(0, MAX_PROMPT_HISTORY) };
      }

      return {
        projects: { ...state.projects, [project.id]: project },
        sessions: { ...state.sessions, [session.id]: session },
        activeSessionId: state.activeSessionId ?? session.id,
        timeline,
        promptHistory,
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

  toggleDebugOverlay: () =>
    set((state) => {
      const next = !state.debugOverlayEnabled;
      saveDebugOverlayEnabled(next);
      return { debugOverlayEnabled: next };
    }),

  backfillTimeline: (events) => {
    if (events.length === 0) return;
    set((state) => {
      const seen = new Set(state.timeline.map((e) => `${e.event.timestamp}|${e.event.agentId}|${e.event.hookEventName}|${e.event.toolUseId ?? ""}`));
      const additions = events
        .filter((event) => !seen.has(`${event.timestamp}|${event.agentId}|${event.hookEventName}|${event.toolUseId ?? ""}`))
        .map((event) => ({ id: nextTimelineId++, event }));
      if (additions.length === 0) return state;
      const merged = [...additions, ...state.timeline].sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp));

      // Extract prompts from backfilled events
      const promptHistory = { ...state.promptHistory };
      for (const event of events) {
        if (event.hookEventName === "UserPromptSubmit" && event.target) {
          const sid = event.sessionId;
          const prev = promptHistory[sid] ?? [];
          // Only add if not already present (dedup by timestamp)
          if (!prev.some((p) => p.timestamp === event.timestamp)) {
            promptHistory[sid] = [{ text: event.target, timestamp: event.timestamp }, ...prev]
              .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
              .slice(0, MAX_PROMPT_HISTORY);
          }
        }
      }

      return { timeline: merged.slice(-MAX_TIMELINE_ENTRIES), promptHistory };
    });
  },

  addPermissionRequest: (perm) => {
    set((state) => ({
      pendingPermissions: [...state.pendingPermissions.filter((p) => p.id !== perm.id), perm],
    }));
  },

  resolvePermission: (id, message) => {
    set((state) => {
      const resolved = message ? { ...state.resolvedMessages, [id]: message } : state.resolvedMessages;
      // Auto-clear resolved message after 3s
      if (message) setTimeout(() => {
        useWorkshopStore.setState((s) => {
          const next = { ...s.resolvedMessages };
          delete next[id];
          return { resolvedMessages: next };
        });
      }, 3000);
      return {
        pendingPermissions: state.pendingPermissions.filter((p) => p.id !== id),
        resolvedMessages: resolved,
      };
    });
  },

  setRemoteApproval: (connected) => set({ remoteApprovalConnected: connected }),
}));
