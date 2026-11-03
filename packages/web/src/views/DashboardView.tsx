import { useMemo } from "react";
import { disambiguateProjectNames, type SerializedSession } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { useNow } from "../hooks/useNow.js";
import { teamColorFor } from "../characters/teamColor.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { ProjectSign } from "../components/ProjectSign.js";
import { ProjectNotesEditor } from "../components/ProjectNotesEditor.js";
import { SearchPanel } from "../components/SearchPanel.js";

interface ProjectHealth {
  projectId: string;
  displayName: string;
  color: string;
  sessionCount: number;
  working: number;
  waitingPermission: number;
  error: number;
  idle: number;
  lastEventAt: string;
}

function summarize(sessions: SerializedSession[], nowMs: number): Omit<ProjectHealth, "projectId" | "displayName" | "color"> {
  let working = 0;
  let waitingPermission = 0;
  let error = 0;
  let idle = 0;
  let lastEventAt = "";

  for (const session of sessions) {
    if (session.lastEventAt > lastEventAt) lastEventAt = session.lastEventAt;
    for (const agent of session.agents) {
      if (classifyAgentVisibility(agent, nowMs) === "hidden") continue;
      switch (agent.displayState) {
        case "working":
        case "supervising":
        case "needs_input":
          working++;
          break;
        case "needs_permission":
          waitingPermission++;
          break;
        case "error":
          error++;
          break;
        default:
          idle++;
      }
    }
  }

  return { sessionCount: sessions.length, working, waitingPermission, error, idle, lastEventAt };
}

export function DashboardView({
  onOpenProject,
  onOpenSession
}: {
  onOpenProject: (projectId: string) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const projects = useWorkshopStore((s) => s.projects);
  const sessions = useWorkshopStore((s) => s.sessions);
  const isDark = usePrefersDarkMode();
  const nowMs = useNow();

  const allSessions = useMemo(() => Object.values(sessions), [sessions]);

  const projectList = useMemo(() => {
    const activeIds = new Set(allSessions.filter((s) => s.status !== "ended").map((s) => s.projectId));
    return Object.values(projects).filter((p) => activeIds.has(p.id));
  }, [projects, allSessions]);

  const displayNames = useMemo(() => disambiguateProjectNames(projectList), [projectList]);

  const health = useMemo<ProjectHealth[]>(() => {
    const byProject = new Map<string, SerializedSession[]>();
    for (const session of allSessions) {
      if (session.status === "ended") continue;
      const list = byProject.get(session.projectId) ?? [];
      list.push(session);
      byProject.set(session.projectId, list);
    }
    return projectList
      .map((p) => {
        const list = byProject.get(p.id) ?? [];
        const { colorIndex } = teamColorFor(p.id);
        const palette = CHARACTER_PALETTE[colorIndex % CHARACTER_PALETTE.length];
        return {
          projectId: p.id,
          displayName: displayNames[p.id] ?? p.name,
          color: isDark ? palette.dark : palette.light,
          ...summarize(list, nowMs)
        };
      })
      .sort((a, b) => (b.lastEventAt > a.lastEventAt ? 1 : -1));
  }, [projectList, allSessions, displayNames, isDark, nowMs]);

  return (
    <div className="dashboard-view">
      <SearchPanel onOpenSession={onOpenSession} />
      {health.length === 0 && (
        <p className="dashboard-empty">No active projects yet — start a Claude Code session to see it here.</p>
      )}
      <div className="dashboard-grid">
        {health.map((p) => (
          <div
            key={p.projectId}
            className="dashboard-card"
            role="button"
            tabIndex={0}
            onClick={() => onOpenProject(p.projectId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpenProject(p.projectId);
            }}
          >
            <ProjectSign name={p.displayName} color={p.color} />
            <div className="dashboard-card-stats">
              <span className="dashboard-stat">{p.sessionCount} session{p.sessionCount === 1 ? "" : "s"}</span>
              {p.working > 0 && <span className="dashboard-stat dashboard-stat-working">{p.working} working</span>}
              {p.waitingPermission > 0 && (
                <span className="dashboard-stat dashboard-stat-waiting">{p.waitingPermission} waiting</span>
              )}
              {p.error > 0 && <span className="dashboard-stat dashboard-stat-error">{p.error} error</span>}
              {p.idle > 0 && <span className="dashboard-stat dashboard-stat-idle">{p.idle} idle</span>}
            </div>
            <ProjectNotesEditor projectId={p.projectId} />
          </div>
        ))}
      </div>
    </div>
  );
}
