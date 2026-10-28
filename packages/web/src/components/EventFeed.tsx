import { useMemo, useState } from "react";
import type { WorkshopEvent } from "@agent-workshop/shared";
import type { TimelineEntry } from "../store/useWorkshopStore.js";

type StatusFilter = "all" | "running" | "succeeded" | "failed";

function eventStatus(event: WorkshopEvent): StatusFilter | "other" {
  if (event.hookEventName === "PreToolUse") return "running";
  if (event.hookEventName === "PostToolUse") return "succeeded";
  if (event.hookEventName === "PostToolUseFailure") return "failed";
  return "other";
}

function timeOf(entry: TimelineEntry): string {
  const date = new Date(entry.event.timestamp);
  return Number.isNaN(date.getTime()) ? entry.event.timestamp : date.toLocaleTimeString();
}

export function EventFeed({ entries, sessionId }: { entries: TimelineEntry[]; sessionId: string | null }) {
  const [agentFilter, setAgentFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const scoped = useMemo(() => (sessionId ? entries.filter((e) => e.event.sessionId === sessionId) : entries), [entries, sessionId]);

  const agents = useMemo(() => Array.from(new Set(scoped.map((e) => e.event.agentId))).sort(), [scoped]);
  const tools = useMemo(
    () => Array.from(new Set(scoped.map((e) => e.event.toolName).filter((t): t is string => Boolean(t)))).sort(),
    [scoped]
  );

  const filtered = scoped.filter((entry) => {
    if (agentFilter !== "all" && entry.event.agentId !== agentFilter) return false;
    if (toolFilter !== "all" && entry.event.toolName !== toolFilter) return false;
    if (statusFilter !== "all" && eventStatus(entry.event) !== statusFilter) return false;
    return true;
  });

  return (
    <div className="panel" style={{ minHeight: 0 }}>
      <div className="panel-header">Event feed</div>
      <div className="filters">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
          <option value="all">All tools</option>
          {tools.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="panel-body">
        {[...filtered]
          .slice()
          .reverse()
          .map((entry) => (
            <div className="event-row" key={entry.id}>
              <span className="muted">{timeOf(entry)}</span>
              <span>{entry.event.agentId}</span>
              <span>{entry.event.hookEventName}</span>
              <span>{entry.event.toolName ?? "—"}</span>
              <span className="tool-call-target">{entry.event.target ?? ""}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
