import { useMemo, useState } from "react";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { AgentTree } from "../components/AgentTree.js";
import { EventFeed } from "../components/EventFeed.js";

export function DebugView() {
  const projects = useWorkshopStore((s) => s.projects);
  const sessions = useWorkshopStore((s) => s.sessions);
  const activeSessionId = useWorkshopStore((s) => s.activeSessionId);
  const setActiveSession = useWorkshopStore((s) => s.setActiveSession);
  const timeline = useWorkshopStore((s) => s.timeline);

  const [projectFilter, setProjectFilter] = useState<string>("all");

  const sessionList = useMemo(() => Object.values(sessions), [sessions]);
  const filteredSessions = useMemo(
    () => (projectFilter === "all" ? sessionList : sessionList.filter((s) => s.projectId === projectFilter)),
    [sessionList, projectFilter]
  );

  const activeSession = activeSessionId ? (sessions[activeSessionId] ?? null) : null;

  return (
    <div className="debug-layout">
      <div className="panel">
        <div className="panel-header">Session → agents → tool calls</div>
        <div className="filters">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">All projects</option>
            {Object.values(projects).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={activeSessionId ?? ""} onChange={(e) => setActiveSession(e.target.value)}>
            <option value="" disabled>
              Select a session
            </option>
            {filteredSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 8)} {s.branch ? `· ${s.branch}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="panel-body">
          <AgentTree session={activeSession} />
        </div>
      </div>
      <EventFeed entries={timeline} sessionId={activeSessionId} />
    </div>
  );
}
