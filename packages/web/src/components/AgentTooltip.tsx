import type { SerializedAgent } from "@agent-workshop/shared";
import { relativeTime } from "../lib/text.js";

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export interface AgentTooltipProps {
  agent: SerializedAgent;
  /** For foreman: the latest real user prompt */
  latestPrompt?: string | null;
  nowMs: number;
}

export function AgentTooltip({ agent, latestPrompt, nowMs }: AgentTooltipProps) {
  const active = agent.activeToolCalls[0];
  const startedAt = agent.state.updatedAt;

  return (
    <div className="agent-tooltip">
      {/* Task description (subagents) */}
      {agent.taskDescription && (
        <div className="agent-tooltip-section">
          <span className="agent-tooltip-label">Task:</span> {agent.taskDescription}
        </div>
      )}

      {/* Latest prompt (foreman) */}
      {latestPrompt && (
        <div className="agent-tooltip-section agent-tooltip-prompt">
          <span className="agent-tooltip-label">Prompt:</span> {latestPrompt}
        </div>
      )}

      {/* Current tool call */}
      {active && (
        <div className="agent-tooltip-section">
          <span className="agent-tooltip-label">Tool:</span> {active.toolName}
          {active.target && <span className="muted"> · {active.target}</span>}
          <br />
          <span className="agent-tooltip-label">Running:</span>{" "}
          {formatDuration(nowMs - Date.parse(active.startedAt))}
        </div>
      )}

      {/* Status */}
      <div className="agent-tooltip-section">
        <span className="agent-tooltip-label">Status:</span> {agent.mood}
        {startedAt && (
          <>
            {" · "}
            <span className="muted">started {relativeTime(startedAt, nowMs)}</span>
          </>
        )}
      </div>
    </div>
  );
}
