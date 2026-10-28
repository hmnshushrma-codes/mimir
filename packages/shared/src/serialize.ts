import type { AgentRecord, ProjectRecord, SessionRecord, ToolCallRecord } from "./model.js";

export interface SerializedAgent {
  id: string;
  sessionId: string;
  parentAgentId: string | null;
  correlation: AgentRecord["correlation"];
  agentType: string | null;
  taskDescription: string | null;
  state: AgentRecord["state"];
  presence: AgentRecord["presence"];
  mood: AgentRecord["mood"];
  consecutiveErrors: number;
  lastEventAt: string;
  activeToolCalls: ToolCallRecord[];
  finishedToolCalls: ToolCallRecord[];
}

export interface SerializedSession {
  id: string;
  projectId: string;
  cwd: string | null;
  branch: string | null;
  startedAt: string;
  lastEventAt: string;
  status: SessionRecord["status"];
  agents: SerializedAgent[];
}

export interface SerializedProject {
  id: string;
  name: string;
  rootPath: string;
  worktreeOf: string | null;
  firstSeen: string;
  lastSeen: string;
}

export function serializeAgent(agent: AgentRecord): SerializedAgent {
  return {
    id: agent.id,
    sessionId: agent.sessionId,
    parentAgentId: agent.parentAgentId,
    correlation: agent.correlation,
    agentType: agent.agentType,
    taskDescription: agent.taskDescription,
    state: agent.state,
    presence: agent.presence,
    mood: agent.mood,
    consecutiveErrors: agent.consecutiveErrors,
    lastEventAt: agent.lastEventAt,
    activeToolCalls: Array.from(agent.activeToolCalls.values()),
    finishedToolCalls: agent.finishedToolCalls
  };
}

export function serializeSession(session: SessionRecord): SerializedSession {
  return {
    id: session.id,
    projectId: session.projectId,
    cwd: session.cwd,
    branch: session.branch,
    startedAt: session.startedAt,
    lastEventAt: session.lastEventAt,
    status: session.status,
    agents: Array.from(session.agents.values()).map(serializeAgent)
  };
}

export function serializeProject(project: ProjectRecord): SerializedProject {
  return {
    id: project.id,
    name: project.name,
    rootPath: project.rootPath,
    worktreeOf: project.worktreeOf,
    firstSeen: project.firstSeen,
    lastSeen: project.lastSeen
  };
}
