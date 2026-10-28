import { createInitialAgentState, transitionAgent, type AgentState } from "./agent-state.js";
import { MAIN_AGENT_ID, normalizeToWorkshopEvent, deriveAgentEvent, type WorkshopEvent } from "./workshop-event.js";
import type { HookEventEnvelope } from "./raw-hook-events.js";
import { fallbackProjectInfo, type ProjectInfo } from "./project.js";
import { deriveMood, DEFAULT_LONG_TOOL_CALL_MS, type Mood } from "./mood.js";

export type CorrelationConfidence = "confirmed" | "heuristic" | null;

export interface ToolCallRecord {
  toolUseId: string;
  toolName: string;
  category: string;
  status: "running" | "succeeded" | "failed";
  target: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export type Presence = "active" | "idle" | "stale";

export interface AgentRecord {
  id: string;
  sessionId: string;
  parentAgentId: string | null;
  correlation: CorrelationConfidence;
  agentType: string | null;
  taskDescription: string | null;
  state: AgentState;
  presence: Presence;
  mood: Mood;
  /** Consecutive PostToolUseFailure events with no success in between —
   *  drives the dizzy -> frustrated mood escalation. */
  consecutiveErrors: number;
  lastEventAt: string;
  activeToolCalls: Map<string, ToolCallRecord>;
  finishedToolCalls: ToolCallRecord[];
}

export type SessionStatus = "active" | "idle" | "ended";

export interface SessionRecord {
  id: string;
  projectId: string;
  cwd: string | null;
  branch: string | null;
  startedAt: string;
  lastEventAt: string;
  status: SessionStatus;
  agents: Map<string, AgentRecord>;
}

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  worktreeOf: string | null;
  firstSeen: string;
  lastSeen: string;
}

interface PendingDelegate {
  toolUseId: string;
  byAgentId: string;
  startedAt: string;
}

const MAX_FINISHED_TOOL_CALLS_PER_AGENT = 50;
const MAX_PENDING_DELEGATES_PER_SESSION = 50;

export class WorkshopModel {
  private sessions = new Map<string, SessionRecord>();
  private projects = new Map<string, ProjectRecord>();
  // Every per-session correlation structure below is keyed by session_id
  // (not by agent_id or tool_use_id alone) — this is the invariant that
  // keeps multiple concurrent sessions, including multiple sessions in the
  // same project/repo, from ever cross-contaminating each other's subagents
  // or tool calls. See model.test.ts "cross-session isolation" for the
  // fixture tests that pin this down.
  private pendingDelegates = new Map<string, PendingDelegate[]>();
  /** Every delegate call ever seen this session, keyed by tool_use_id. Unlike
   *  pendingDelegates (consumed FIFO by the live heuristic), this is never
   *  removed, so the async meta.json enrichment (approach B) can still
   *  resolve a parent after the heuristic has already claimed it. */
  private delegateCallsByToolUseId = new Map<string, Map<string, PendingDelegate>>();

  constructor(private readonly longToolCallMs: number = DEFAULT_LONG_TOOL_CALL_MS) {}

  /**
   * @param projectInfo Pre-resolved project identity for this event's cwd.
   *   Server callers resolve this via git (packages/server/project-resolver.ts)
   *   before calling ingest(), keeping WorkshopModel itself platform-agnostic
   *   (so demo mode can call it unchanged, browser-side, with no real git
   *   access). Omit to fall back to a plain cwd-basename identity.
   */
  ingest(
    envelope: HookEventEnvelope,
    projectInfo?: ProjectInfo
  ): { workshopEvent: WorkshopEvent; project: ProjectRecord; session: SessionRecord; agent: AgentRecord } {
    const workshopEvent = normalizeToWorkshopEvent(envelope);
    const resolvedProjectInfo = projectInfo ?? fallbackProjectInfo((envelope as { cwd?: string }).cwd ?? null);
    const project = this.getOrCreateProject(resolvedProjectInfo, workshopEvent.timestamp);
    const session = this.getOrCreateSession(workshopEvent, project.id, resolvedProjectInfo.branch);
    const agent = this.getOrCreateAgent(session, workshopEvent, envelope);

    session.lastEventAt = workshopEvent.timestamp;
    session.status = "active";
    if (resolvedProjectInfo.branch !== null) session.branch = resolvedProjectInfo.branch;
    if (workshopEvent.hookEventName === "SessionEnd") session.status = "ended";

    project.lastSeen = workshopEvent.timestamp;

    agent.lastEventAt = workshopEvent.timestamp;
    agent.presence = "active";

    this.trackDelegation(session, agent, workshopEvent);
    this.trackToolCall(agent, workshopEvent);

    const agentEvent = deriveAgentEvent(envelope);
    if (agentEvent) {
      agent.state = transitionAgent(agent.state, agentEvent);
    }

    this.recomputeMood(agent, workshopEvent.timestamp);

    return { workshopEvent, project, session, agent };
  }

  private earliestActiveToolCallStart(agent: AgentRecord): string | null {
    let earliest: string | null = null;
    for (const call of agent.activeToolCalls.values()) {
      if (earliest === null || call.startedAt < earliest) earliest = call.startedAt;
    }
    return earliest;
  }

  private recomputeMood(agent: AgentRecord, nowIso: string): void {
    agent.mood = deriveMood(
      {
        lifecycle: agent.state.lifecycle,
        category: agent.state.category,
        activeToolCallStartedAt: this.earliestActiveToolCallStart(agent),
        consecutiveErrors: agent.consecutiveErrors,
        nowIso
      },
      this.longToolCallMs
    );
  }

  private getOrCreateProject(info: ProjectInfo, nowIso: string): ProjectRecord {
    let project = this.projects.get(info.id);
    if (!project) {
      project = {
        id: info.id,
        name: info.name,
        rootPath: info.rootPath,
        worktreeOf: info.worktreeOf,
        firstSeen: nowIso,
        lastSeen: nowIso
      };
      this.projects.set(info.id, project);
    }
    return project;
  }

  private getOrCreateSession(event: WorkshopEvent, projectId: string, branch: string | null): SessionRecord {
    let session = this.sessions.get(event.sessionId);
    if (!session) {
      session = {
        id: event.sessionId,
        projectId,
        cwd: (event.raw as { cwd?: string }).cwd ?? null,
        branch,
        startedAt: event.timestamp,
        lastEventAt: event.timestamp,
        status: "active",
        agents: new Map()
      };
      this.sessions.set(event.sessionId, session);
    }
    return session;
  }

  private getOrCreateAgent(session: SessionRecord, event: WorkshopEvent, envelope: HookEventEnvelope): AgentRecord {
    let agent = session.agents.get(event.agentId);
    if (!agent) {
      const taskDescription =
        typeof (envelope as { task_description?: unknown }).task_description === "string"
          ? ((envelope as { task_description?: string }).task_description as string)
          : null;

      agent = {
        id: event.agentId,
        sessionId: session.id,
        parentAgentId: null,
        correlation: event.agentId === MAIN_AGENT_ID ? null : "heuristic",
        agentType: event.agentType,
        taskDescription,
        state: createInitialAgentState(event.timestamp),
        presence: "active",
        mood: "neutral",
        consecutiveErrors: 0,
        lastEventAt: event.timestamp,
        activeToolCalls: new Map(),
        finishedToolCalls: []
      };

      if (event.agentId !== MAIN_AGENT_ID) {
        this.claimDelegation(session, agent);
      }

      session.agents.set(event.agentId, agent);
    } else if (event.agentType && !agent.agentType) {
      agent.agentType = event.agentType;
    }
    return agent;
  }

  /** Approach A from docs/hook-events.md §4: best-effort FIFO pairing of a
   *  delegate PreToolUse with the next SubagentStart. */
  private trackDelegation(session: SessionRecord, agent: AgentRecord, event: WorkshopEvent): void {
    if (event.hookEventName !== "PreToolUse" || event.category !== "delegate") return;
    const toolUseId = event.toolUseId ?? `anon-${event.timestamp}-${agent.id}`;
    const record: PendingDelegate = { toolUseId, byAgentId: agent.id, startedAt: event.timestamp };

    const queue = this.pendingDelegates.get(session.id) ?? [];
    queue.push(record);
    while (queue.length > MAX_PENDING_DELEGATES_PER_SESSION) queue.shift();
    this.pendingDelegates.set(session.id, queue);

    const byToolUseId = this.delegateCallsByToolUseId.get(session.id) ?? new Map();
    byToolUseId.set(toolUseId, record);
    this.delegateCallsByToolUseId.set(session.id, byToolUseId);
  }

  /** Looks up which agent made the delegate call with this tool_use_id, for
   *  the meta.json enrichment pass (approach B). */
  resolveParentByToolUseId(sessionId: string, toolUseId: string): string | null {
    return this.delegateCallsByToolUseId.get(sessionId)?.get(toolUseId)?.byAgentId ?? null;
  }

  private claimDelegation(session: SessionRecord, newAgent: AgentRecord): void {
    const queue = this.pendingDelegates.get(session.id);
    if (!queue || queue.length === 0) {
      newAgent.parentAgentId = MAIN_AGENT_ID;
      newAgent.correlation = "heuristic";
      return;
    }
    const claimed = queue.shift();
    newAgent.parentAgentId = claimed?.byAgentId ?? MAIN_AGENT_ID;
    newAgent.correlation = "heuristic";
  }

  /** Approach B enrichment: upgrade a heuristic pairing to confirmed using the
   *  sibling agent-<id>.meta.json file, if it was found (see correlation.ts). */
  confirmDelegation(sessionId: string, agentId: string, parentAgentId: string, taskDescription: string | null): void {
    const session = this.sessions.get(sessionId);
    const agent = session?.agents.get(agentId);
    if (!agent) return;
    agent.parentAgentId = parentAgentId;
    agent.correlation = "confirmed";
    if (taskDescription && !agent.taskDescription) agent.taskDescription = taskDescription;
  }

  private trackToolCall(agent: AgentRecord, event: WorkshopEvent): void {
    if (event.hookEventName === "PreToolUse" && event.toolName && event.toolUseId) {
      agent.activeToolCalls.set(event.toolUseId, {
        toolUseId: event.toolUseId,
        toolName: event.toolName,
        category: event.category,
        status: "running",
        target: event.target,
        startedAt: event.timestamp,
        finishedAt: null,
        durationMs: null
      });
      return;
    }

    const isSuccess = event.hookEventName === "PostToolUse";
    const isFailure = event.hookEventName === "PostToolUseFailure";
    if ((isSuccess || isFailure) && event.toolUseId) {
      const active = agent.activeToolCalls.get(event.toolUseId);
      const finishedAt = event.timestamp;
      const startedAt = active?.startedAt ?? finishedAt;
      const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);

      const finished: ToolCallRecord = {
        toolUseId: event.toolUseId,
        toolName: active?.toolName ?? event.toolName ?? "unknown",
        category: active?.category ?? event.category,
        status: isSuccess ? "succeeded" : "failed",
        target: active?.target ?? event.target,
        startedAt,
        finishedAt,
        durationMs: Number.isFinite(durationMs) ? durationMs : null
      };

      agent.activeToolCalls.delete(event.toolUseId);
      agent.finishedToolCalls.push(finished);
      while (agent.finishedToolCalls.length > MAX_FINISHED_TOOL_CALLS_PER_AGENT) {
        agent.finishedToolCalls.shift();
      }

      agent.consecutiveErrors = isSuccess ? 0 : agent.consecutiveErrors + 1;
    }
  }

  /** Returns the agents whose presence actually changed, so callers can
   *  broadcast just those updates. */
  sweepPresence(nowIso: string, idleMs: number, staleMs: number): Array<{ sessionId: string; agentId: string }> {
    const touched: Array<{ sessionId: string; agentId: string }> = [];
    const now = Date.parse(nowIso);
    for (const session of this.sessions.values()) {
      for (const agent of session.agents.values()) {
        const elapsed = now - Date.parse(agent.lastEventAt);
        const next: Presence = elapsed >= staleMs ? "stale" : elapsed >= idleMs ? "idle" : "active";
        if (next !== agent.presence) {
          agent.presence = next;
          touched.push({ sessionId: session.id, agentId: agent.id });
        }
      }
    }
    return touched;
  }

  /** The state machine has no internal clock — something has to decide when
   *  a "done" agent (thumbs up shown) actually DEPARTs (walks out). This is
   *  that decision, kept here rather than in the UI so the UI still only
   *  renders state, per the brief's "single source of truth" requirement. */
  sweepDepartures(nowIso: string, departAfterMs: number): Array<{ sessionId: string; agentId: string }> {
    const touched: Array<{ sessionId: string; agentId: string }> = [];
    const now = Date.parse(nowIso);
    for (const session of this.sessions.values()) {
      for (const agent of session.agents.values()) {
        if (agent.state.lifecycle === "done" && now - Date.parse(agent.state.updatedAt) >= departAfterMs) {
          agent.state = transitionAgent(agent.state, { type: "DEPART", at: nowIso });
          touched.push({ sessionId: session.id, agentId: agent.id });
        }
      }
    }
    return touched;
  }

  /** Mood can change purely from elapsed time (a tool call crossing the
   *  "long" threshold) with no new event to trigger ingest()'s own
   *  recomputeMood call — this sweep covers that case. Returns the agents
   *  whose mood actually changed. */
  sweepMoods(nowIso: string): Array<{ sessionId: string; agentId: string }> {
    const touched: Array<{ sessionId: string; agentId: string }> = [];
    for (const session of this.sessions.values()) {
      for (const agent of session.agents.values()) {
        const previous = agent.mood;
        this.recomputeMood(agent, nowIso);
        if (agent.mood !== previous) touched.push({ sessionId: session.id, agentId: agent.id });
      }
    }
    return touched;
  }

  /** Session-level lifecycle: active -> idle -> ended, independent of each
   *  agent's own presence. SessionEnd sets "ended" immediately in ingest();
   *  this sweep only covers sessions that went quiet without ever sending
   *  one. Returns the sessions whose status actually changed. */
  sweepSessionStatus(nowIso: string, idleMs: number, endedAfterMs: number): Array<{ sessionId: string }> {
    const touched: Array<{ sessionId: string }> = [];
    const now = Date.parse(nowIso);
    for (const session of this.sessions.values()) {
      if (session.status === "ended") continue;
      const elapsed = now - Date.parse(session.lastEventAt);
      const next: SessionStatus = elapsed >= endedAfterMs ? "ended" : elapsed >= idleMs ? "idle" : "active";
      if (next !== session.status) {
        session.status = next;
        touched.push({ sessionId: session.id });
      }
    }
    return touched;
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  getProject(projectId: string): ProjectRecord | undefined {
    return this.projects.get(projectId);
  }

  getProjects(): ProjectRecord[] {
    return Array.from(this.projects.values());
  }

  getSnapshot(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }
}
