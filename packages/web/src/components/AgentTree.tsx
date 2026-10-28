import type { SerializedAgent, SerializedSession, ToolCallRecord } from "@agent-workshop/shared";

function duration(call: ToolCallRecord): string {
  if (call.durationMs != null) return `${call.durationMs}ms`;
  if (call.status === "running") return "…";
  return "-";
}

function ToolCallRow({ call }: { call: ToolCallRecord }) {
  return (
    <div className="tool-call-row">
      <span>{call.toolName}</span>
      <span className={`status-${call.status}`}>{call.status}</span>
      <span className="tool-call-target" title={call.target ?? undefined}>
        {call.target ?? "—"}
      </span>
      <span className="muted">{duration(call)}</span>
    </div>
  );
}

function AgentNode({ agent }: { agent: SerializedAgent }) {
  const calls = [...agent.activeToolCalls, ...agent.finishedToolCalls].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)
  );

  return (
    <div className="agent-node">
      <div className="agent-node-header">
        <span className={`lifecycle-${agent.state.lifecycle}`}>●</span>
        <span>{agent.id === "main" ? "main" : (agent.agentType ?? agent.id)}</span>
        <span className="muted">({agent.state.lifecycle})</span>
        {agent.presence !== "active" && <span className="badge">{agent.presence}</span>}
      </div>
      {agent.taskDescription && <div className="agent-node-meta">{agent.taskDescription}</div>}
      {agent.parentAgentId && (
        <div className="agent-node-meta">
          parent: {agent.parentAgentId} ({agent.correlation})
        </div>
      )}
      {calls.length === 0 ? (
        <div className="agent-node-meta">no tool calls yet</div>
      ) : (
        calls.map((call) => <ToolCallRow key={call.toolUseId} call={call} />)
      )}
    </div>
  );
}

export function AgentTree({ session }: { session: SerializedSession | null }) {
  if (!session) return <div className="muted">No session yet.</div>;

  const ordered = [...session.agents].sort((a, b) => (a.id === "main" ? -1 : b.id === "main" ? 1 : a.id.localeCompare(b.id)));

  return (
    <div>
      {ordered.map((agent) => (
        <AgentNode key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
