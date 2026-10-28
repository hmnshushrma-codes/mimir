import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { disambiguateProjectNames, type SerializedSession } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { sortByAttention } from "../characters/attention.js";
import { useNow } from "../hooks/useNow.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { teamColorFor } from "../characters/teamColor.js";
import { loadAvatar, saveAvatar, type AvatarConfig } from "../characters/avatarConfig.js";
import { FilterChips } from "../components/FilterChips.js";
import { RoomBackdrop } from "../components/RoomBackdrop.js";
import { ProjectSign } from "../components/ProjectSign.js";
import { DeskArea } from "../components/DeskArea.js";
import { UserDesk } from "../components/UserDesk.js";
import { AvatarWizard } from "../components/AvatarWizard.js";
import { FinishedSessionsShelf } from "../components/FinishedSessionsShelf.js";
import { AgentSidePanel } from "../components/AgentSidePanel.js";

/** Group sessions by project, maintaining attention-sorted order within each. */
function groupByProject(sessions: SerializedSession[]): Map<string, SerializedSession[]> {
  const groups = new Map<string, SerializedSession[]>();
  for (const s of sessions) {
    const list = groups.get(s.projectId) ?? [];
    list.push(s);
    groups.set(s.projectId, list);
  }
  return groups;
}

function projectColor(sessions: SerializedSession[], isDark: boolean): string {
  if (sessions.length === 0) return "#888";
  const { colorIndex } = teamColorFor(sessions[0].id);
  const p = CHARACTER_PALETTE[colorIndex % CHARACTER_PALETTE.length];
  return isDark ? p.dark : p.light;
}

export function WorkshopView() {
  const projects = useWorkshopStore((s) => s.projects);
  const sessions = useWorkshopStore((s) => s.sessions);
  const timeline = useWorkshopStore((s) => s.timeline);
  const projectFilter = useWorkshopStore((s) => s.projectFilter);
  const setProjectFilter = useWorkshopStore((s) => s.setProjectFilter);
  const focusedSessionId = useWorkshopStore((s) => s.focusedSessionId);
  const setFocusedSession = useWorkshopStore((s) => s.setFocusedSession);

  const reducedMotion = useReducedMotion() ?? false;
  const nowMs = useNow();
  const isDark = usePrefersDarkMode();
  const [selectedAgentId, setSelectedAgentId] = useState<{ sessionId: string; agentId: string } | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfig>(loadAvatar);
  const [showWizard, setShowWizard] = useState(false);
  const handleSaveAvatar = useCallback((config: AvatarConfig) => {
    saveAvatar(config);
    setAvatar(config);
  }, []);

  const allSessions = useMemo(() => Object.values(sessions), [sessions]);

  // Only show projects that have at least one non-ended session
  const activeProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of allSessions) {
      if (s.status !== "ended") ids.add(s.projectId);
    }
    return ids;
  }, [allSessions]);

  const projectList = useMemo(
    () => Object.values(projects).filter((p) => activeProjectIds.has(p.id)),
    [projects, activeProjectIds]
  );
  const displayNames = useMemo(() => disambiguateProjectNames(projectList), [projectList]);

  const visibleSessions = useMemo(() => {
    // Only show sessions from active projects (ignore stale rehydrated ones)
    let list = allSessions.filter((s) => activeProjectIds.has(s.projectId));
    if (focusedSessionId) list = list.filter((s) => s.id === focusedSessionId);
    else if (projectFilter) list = list.filter((s) => s.projectId === projectFilter);
    return list;
  }, [allSessions, activeProjectIds, projectFilter, focusedSessionId]);

  const liveSessions = useMemo(() => visibleSessions.filter((s) => s.status !== "ended"), [visibleSessions]);
  const endedSessions = useMemo(() => visibleSessions.filter((s) => s.status === "ended"), [visibleSessions]);

  const sortedLiveSessions = useMemo(
    () => sortByAttention(liveSessions, (s) => s.agents.map((a) => a.mood)),
    [liveSessions]
  );

  const projectGroups = useMemo(() => groupByProject(sortedLiveSessions), [sortedLiveSessions]);

  const latestPromptBySession = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of timeline) {
      if (entry.event.hookEventName === "UserPromptSubmit" && entry.event.target) {
        map.set(entry.event.sessionId, entry.event.target);
      }
    }
    return map;
  }, [timeline]);

  const selectedAgent = selectedAgentId ? (sessions[selectedAgentId.sessionId]?.agents.find((a) => a.id === selectedAgentId.agentId) ?? null) : null;
  const selectedOrdinal = selectedAgentId
    ? Math.max(
        1,
        (sessions[selectedAgentId.sessionId]?.agents.filter((a) => a.id !== "main").findIndex((a) => a.id === selectedAgentId.agentId) ?? -1) + 1
      )
    : 1;
  const selectedEntries = useMemo(
    () => (selectedAgentId ? timeline.filter((e) => e.event.sessionId === selectedAgentId.sessionId && e.event.agentId === selectedAgentId.agentId) : []),
    [timeline, selectedAgentId]
  );

  if (allSessions.length === 0) {
    return <div className="workshop-placeholder">Waiting for the first event\u2026</div>;
  }

  return (
    <div className="workshop-scene">
      <div className="workshop-floor">
        <RoomBackdrop />

        <div className="room-content">
          <FilterChips
            projects={projectList.map((p) => ({ id: p.id, name: displayNames[p.id] ?? p.name }))}
            activeFilter={projectFilter}
            onSelect={(id) => {
              setProjectFilter(id);
              setFocusedSession(null);
            }}
          />

          <div className="desk-grid">
            {Array.from(projectGroups.entries()).map(([projectId, projectSessions]) => {
              // Latest prompt across all sessions in this project
              const projectPrompt = projectSessions.reduce<string | null>((best, s) => latestPromptBySession.get(s.id) ?? best, null);
              return (
                <div key={projectId} className="project-group">
                  <ProjectSign
                    name={displayNames[projectId] ?? projects[projectId]?.name ?? "unknown"}
                    color={projectColor(projectSessions, isDark)}
                  />
                  <div className="project-desks">
                    {/* One User per project */}
                    <div className="project-user-desk">
                      <UserDesk latestPrompt={projectPrompt} avatar={avatar} onEditAvatar={() => setShowWizard(true)} />
                    </div>
                    <AnimatePresence>
                      {projectSessions.map((session) => (
                        <DeskArea
                          key={session.id}
                          session={session}
                          projectName={displayNames[session.projectId] ?? "unknown"}
                          latestPrompt={latestPromptBySession.get(session.id) ?? null}
                          selectedAgentId={selectedAgentId?.sessionId === session.id ? selectedAgentId.agentId : null}
                          onSelectAgent={(agentId) => setSelectedAgentId({ sessionId: session.id, agentId })}
                          onFocus={() => setFocusedSession(focusedSessionId === session.id ? null : session.id)}
                          focused={focusedSessionId === session.id}
                          reducedMotion={reducedMotion}
                          nowMs={nowMs}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          <FinishedSessionsShelf sessions={endedSessions} projectNameFor={(id) => displayNames[id] ?? projects[id]?.name ?? "unknown"} />
        </div>
      </div>

      <AnimatePresence>
        {selectedAgent && selectedAgentId && (
          <AgentSidePanel
            agent={selectedAgent}
            sessionId={selectedAgentId.sessionId}
            ordinal={selectedOrdinal}
            entries={selectedEntries}
            onClose={() => setSelectedAgentId(null)}
          />
        )}
      </AnimatePresence>

      {showWizard && (
        <AvatarWizard initial={avatar} onSave={handleSaveAvatar} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
