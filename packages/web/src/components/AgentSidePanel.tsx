import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SerializedAgent } from "@agent-workshop/shared";
import type { TimelineEntry } from "../store/useWorkshopStore.js";
import { workerLabel } from "../characters/names.js";
import { teamColorFor } from "../characters/teamColor.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";

interface MergedRow {
  id: string;
  time: string;
  kind: "tool" | "notification";
  toolName?: string;
  target?: string | null;
  durationMs?: number | null;
  status?: "running" | "succeeded" | "failed";
  message?: string;
}

function StatusIcon({ status }: { status: "running" | "succeeded" | "failed" }) {
  if (status === "running") return <span className="spinner" aria-label="running" />;
  if (status === "succeeded") return <span className="status-succeeded">✓</span>;
  return <span className="status-failed">✗</span>;
}

export function AgentSidePanel({
  agent,
  sessionId,
  ordinal,
  entries,
  onClose
}: {
  agent: SerializedAgent;
  sessionId: string;
  ordinal: number;
  entries: TimelineEntry[];
  onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const isDark = usePrefersDarkMode();
  const { colorIndex } = teamColorFor(sessionId);
  const palette = CHARACTER_PALETTE[colorIndex % CHARACTER_PALETTE.length];
  const accent = isDark ? palette.dark : palette.light;

  const title = agent.id === "main" ? "Foreman (main)" : workerLabel(agent.id, ordinal);

  const mergedRows = useMemo<MergedRow[]>(() => {
    const toolRows: MergedRow[] = [...agent.activeToolCalls, ...agent.finishedToolCalls].map((c) => ({
      id: c.toolUseId,
      time: c.startedAt,
      kind: "tool",
      toolName: c.toolName,
      target: c.target,
      durationMs: c.durationMs,
      status: c.status
    }));
    const notificationRows: MergedRow[] = entries
      .filter((e) => e.event.hookEventName === "Notification")
      .map((e) => ({ id: `notif-${e.id}`, time: e.event.timestamp, kind: "notification", message: e.event.target ?? "" }));
    return [...toolRows, ...notificationRows].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  }, [agent.activeToolCalls, agent.finishedToolCalls, entries]);

  return (
    <motion.aside className="side-panel" style={{ borderColor: accent }} initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }} transition={{ duration: 0.25 }}>
      <div className="panel-header" style={{ borderBottomColor: accent }}>
        {title}
        <button className="tab-button" onClick={onClose} style={{ float: "right" }}>
          Close
        </button>
      </div>
      {agent.taskDescription && (
        <div className="agent-node-meta" style={{ padding: "8px 12px" }}>
          {agent.taskDescription}
        </div>
      )}
      <div className="filters">
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
          Show raw events
        </label>
      </div>
      <div className="panel-body">
        {!showRaw &&
          (mergedRows.length === 0 ? (
            <div className="muted">No tool calls yet.</div>
          ) : (
            mergedRows.map((row) =>
              row.kind === "tool" ? (
                <div className="event-row" key={row.id} style={{ gridTemplateColumns: "70px 90px 1fr 60px 20px" }}>
                  <span className="muted">{new Date(row.time).toLocaleTimeString()}</span>
                  <span>{row.toolName}</span>
                  <span className="tool-call-target">{row.target ?? ""}</span>
                  <span className="muted">{row.durationMs != null ? `${row.durationMs}ms` : ""}</span>
                  <StatusIcon status={row.status ?? "running"} />
                </div>
              ) : (
                <div className="event-row" key={row.id} style={{ gridTemplateColumns: "70px 1fr" }}>
                  <span className="muted">{new Date(row.time).toLocaleTimeString()}</span>
                  <span className="tool-call-target">🔔 {row.message}</span>
                </div>
              )
            )
          ))}
        {showRaw &&
          (entries.length === 0 ? (
            <div className="muted">No events yet.</div>
          ) : (
            entries.map((entry) => (
              <div className="event-row" key={entry.id} style={{ gridTemplateColumns: "70px 90px 90px 1fr" }}>
                <span className="muted">{new Date(entry.event.timestamp).toLocaleTimeString()}</span>
                <span>{entry.event.hookEventName}</span>
                <span>{entry.event.toolName ?? "—"}</span>
                <span className="tool-call-target">{entry.event.target ?? ""}</span>
              </div>
            ))
          ))}
      </div>
    </motion.aside>
  );
}
