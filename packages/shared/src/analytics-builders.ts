/**
 * Analytics builder functions — transform WorkshopModel records into
 * the analytics types defined in analytics.ts.
 *
 * These are pure functions operating on serialized or raw model data.
 * They form the bridge between the live event model and the analytics layer.
 */

import type { SessionRecord, AgentRecord, ToolCallRecord } from "./model.js";
import type {
  SessionAnalytics,
  ToolCallAnalytics,
  PermissionEvent,
  TimelineEvent,
  TimelineEventType,
  AgentAnalytics,
  DashboardMetrics,
  TokenUsage,
} from "./analytics.js";
import { EMPTY_TOKEN_USAGE } from "./analytics.js";
import { MAIN_AGENT_ID } from "./workshop-event.js";

// ─── Session analytics ──────────────────────────────────────────────

export function buildSessionAnalytics(
  session: SessionRecord,
  prompt: string | null = null
): SessionAnalytics {
  const agents = Array.from(session.agents.values());
  const allToolCalls = agents.flatMap((a) => [
    ...Array.from(a.activeToolCalls.values()),
    ...a.finishedToolCalls,
  ]);

  const startMs = Date.parse(session.startedAt);
  const lastMs = Date.parse(session.lastEventAt);
  // Wall clock duration: always computed from lastEventAt - startedAt,
  // not just for ended sessions. This fixes the "0ms / —" display bug.
  const wallClockMs = Number.isFinite(lastMs - startMs) && lastMs > startMs ? lastMs - startMs : null;

  let permissionRequests = 0;
  for (const agent of agents) {
    if (agent.state.needsPermission) permissionRequests++;
  }

  return {
    sessionId: session.id,
    projectId: session.projectId,
    startedAt: session.startedAt,
    endedAt: session.status === "ended" ? session.lastEventAt : null,
    durationMs: wallClockMs,
    agentCount: agents.length,
    subagentCount: agents.filter((a) => a.id !== MAIN_AGENT_ID).length,
    toolCallCount: allToolCalls.length,
    successfulToolCalls: allToolCalls.filter((tc) => tc.status === "succeeded").length,
    failedToolCalls: allToolCalls.filter((tc) => tc.status === "failed").length,
    permissionRequests,
    prompt,
    tokenUsage: EMPTY_TOKEN_USAGE,
    cost: null,
  };
}

// ─── Tool call analytics ────────────────────────────────────────────

/** Build analytics for all tool calls in a session, detecting retries. */
export function buildToolCallAnalytics(session: SessionRecord): ToolCallAnalytics[] {
  const result: ToolCallAnalytics[] = [];
  // Track tool+target combos to detect retries
  const seenFailures = new Map<string, number>(); // "toolName:target" → count

  for (const agent of session.agents.values()) {
    const allCalls = [...agent.finishedToolCalls, ...Array.from(agent.activeToolCalls.values())];
    for (const tc of allCalls) {
      const key = `${tc.toolName}:${tc.target ?? ""}`;
      const priorFailures = seenFailures.get(key) ?? 0;
      const isRetry = priorFailures > 0;

      result.push({
        toolUseId: tc.toolUseId,
        sessionId: session.id,
        agentId: agent.id,
        toolName: tc.toolName,
        category: tc.category,
        status: tc.status,
        target: tc.target,
        startedAt: tc.startedAt,
        finishedAt: tc.finishedAt,
        durationMs: tc.durationMs,
        isRetry,
      });

      if (tc.status === "failed") {
        seenFailures.set(key, priorFailures + 1);
      } else if (tc.status === "succeeded") {
        seenFailures.delete(key); // Reset on success
      }
    }
  }

  return result;
}

// ─── Agent analytics ────────────────────────────────────────────────

export function buildAgentAnalytics(agent: AgentRecord): AgentAnalytics {
  const allCalls = [...agent.finishedToolCalls, ...Array.from(agent.activeToolCalls.values())];
  const startMs = allCalls.length > 0
    ? Math.min(...allCalls.map((tc) => Date.parse(tc.startedAt)))
    : Date.parse(agent.lastEventAt);
  const endMs = Date.parse(agent.lastEventAt);

  return {
    agentId: agent.id,
    sessionId: agent.sessionId,
    agentType: agent.agentType,
    taskDescription: agent.taskDescription,
    parentAgentId: agent.parentAgentId,
    startedAt: new Date(startMs).toISOString(),
    finishedAt: agent.state.done ? agent.lastEventAt : null,
    durationMs: endMs - startMs,
    toolCallCount: allCalls.length,
    successfulToolCalls: allCalls.filter((tc) => tc.status === "succeeded").length,
    failedToolCalls: allCalls.filter((tc) => tc.status === "failed").length,
    stateTimeline: {}, // Populated by telemetry module (P3-02)
    tokenUsage: EMPTY_TOKEN_USAGE,
  };
}

// ─── Permission events ──────────────────────────────────────────────

/** Extract permission events from the current agent states.
 *  Full lifecycle tracking (decidedAt, waitingDuration) requires the
 *  telemetry module (P3-02) to store event timestamps. For now this
 *  builds a snapshot of current permission state. */
export function buildPermissionEvents(session: SessionRecord): PermissionEvent[] {
  const events: PermissionEvent[] = [];
  let id = 0;

  for (const agent of session.agents.values()) {
    if (agent.state.needsPermission) {
      events.push({
        id: `perm-${session.id}-${agent.id}-${id++}`,
        sessionId: session.id,
        agentId: agent.id,
        toolName: agent.activeToolCalls.size > 0
          ? Array.from(agent.activeToolCalls.values())[0].toolName
          : null,
        commandPreview: agent.activeToolCalls.size > 0
          ? Array.from(agent.activeToolCalls.values())[0].target
          : null,
        requestedAt: agent.lastEventAt,
        decidedAt: null,
        decision: "pending",
        waitingDurationMs: null,
        requestType: "permission",
      });
    }

    // Check for AskUserQuestion tool calls → user_input
    for (const tc of agent.activeToolCalls.values()) {
      if (tc.toolName === "AskUserQuestion") {
        events.push({
          id: `input-${session.id}-${agent.id}-${id++}`,
          sessionId: session.id,
          agentId: agent.id,
          toolName: tc.toolName,
          commandPreview: tc.target,
          requestedAt: tc.startedAt,
          decidedAt: null,
          decision: "pending",
          waitingDurationMs: null,
          requestType: "user_input",
        });
      }
    }
  }

  return events;
}

// ─── Timeline events ────────────────────────────────────────────────

/** Build a flat timeline of events from a session's agents and tool calls. */
export function buildTimelineEvents(session: SessionRecord): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let id = 0;

  // Session start
  events.push({
    id: `tl-${id++}`,
    sessionId: session.id,
    agentId: MAIN_AGENT_ID,
    type: "session_start",
    timestamp: session.startedAt,
    label: "Session started",
    detail: session.cwd,
    category: null,
    durationMs: null,
  });

  for (const agent of session.agents.values()) {
    // Agent spawn (subagents only)
    if (agent.id !== MAIN_AGENT_ID) {
      events.push({
        id: `tl-${id++}`,
        sessionId: session.id,
        agentId: agent.id,
        type: "agent_spawn",
        timestamp: agent.finishedToolCalls[0]?.startedAt ?? agent.lastEventAt,
        label: `${agent.agentType ?? "subagent"} spawned`,
        detail: agent.taskDescription,
        category: null,
        durationMs: null,
      });
    }

    // Tool calls
    const allCalls = [...agent.finishedToolCalls, ...Array.from(agent.activeToolCalls.values())];
    for (const tc of allCalls) {
      const type: TimelineEventType = tc.status === "failed" ? "tool_failure"
        : tc.finishedAt ? "tool_end"
        : "tool_start";

      events.push({
        id: `tl-${id++}`,
        sessionId: session.id,
        agentId: agent.id,
        type,
        timestamp: tc.finishedAt ?? tc.startedAt,
        label: `${tc.toolName}${tc.target ? ` · ${tc.target}` : ""}`,
        detail: tc.status === "failed" ? "failed" : null,
        category: tc.category,
        durationMs: tc.durationMs,
      });
    }

    // Permission requests
    if (agent.state.needsPermission) {
      events.push({
        id: `tl-${id++}`,
        sessionId: session.id,
        agentId: agent.id,
        type: "permission_request",
        timestamp: agent.lastEventAt,
        label: "Permission requested",
        detail: null,
        category: null,
        durationMs: null,
      });
    }

    // Agent stop (done subagents)
    if (agent.id !== MAIN_AGENT_ID && agent.state.done) {
      events.push({
        id: `tl-${id++}`,
        sessionId: session.id,
        agentId: agent.id,
        type: "agent_stop",
        timestamp: agent.lastEventAt,
        label: `${agent.agentType ?? "subagent"} finished`,
        detail: null,
        category: null,
        durationMs: null,
      });
    }
  }

  // Session end
  if (session.status === "ended") {
    events.push({
      id: `tl-${id++}`,
      sessionId: session.id,
      agentId: MAIN_AGENT_ID,
      type: "session_end",
      timestamp: session.lastEventAt,
      label: "Session ended",
      detail: null,
      category: null,
      durationMs: null,
    });
  }

  // Sort by timestamp
  return events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

// ─── Dashboard aggregation ──────────────────────────────────────────

export function buildDashboardMetrics(sessions: SessionRecord[]): DashboardMetrics {
  let totalAgents = 0;
  let totalToolCalls = 0;
  let totalDurationMs = 0;
  let completedTasks = 0;
  let failedTasks = 0;
  let sessionDurations: number[] = [];

  for (const session of sessions) {
    const analytics = buildSessionAnalytics(session);
    totalAgents += analytics.agentCount;
    totalToolCalls += analytics.toolCallCount;
    completedTasks += analytics.successfulToolCalls;
    failedTasks += analytics.failedToolCalls;

    if (analytics.durationMs !== null) {
      totalDurationMs += analytics.durationMs;
      sessionDurations.push(analytics.durationMs);
    }
  }

  const avgSessionDurationMs = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : null;

  return {
    totalSessions: sessions.length,
    totalAgents,
    totalToolCalls,
    totalDurationMs,
    avgSessionDurationMs,
    avgTaskDurationMs: null, // Requires per-task duration tracking (P3-02)
    completedTasks,
    failedTasks,
    tokenUsage: EMPTY_TOKEN_USAGE,
    totalCost: { value: 0, availability: "unavailable", source: "none" },
    computedAt: new Date().toISOString(),
  };
}
