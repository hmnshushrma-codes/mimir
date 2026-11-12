import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { disambiguateProjectNames, type SerializedSession } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { sortByAttention } from "../characters/attention.js";
import { useNow } from "../hooks/useNow.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { teamColorFor } from "../characters/teamColor.js";
import { loadAvatar, saveAvatar, type AvatarConfig } from "../characters/avatarConfig.js";
import { isDemoMode } from "../data/demoSource.js";
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

  // Sessions that just ended get a 4-second sleep delay before removal.
  // Track which session IDs are in the "sleeping before removal" phase.
  const [sleepingSessionIds, setSleepingSessionIds] = useState<Set<string>>(new Set());
  const sleepTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // When a session transitions to "ended", start the sleep timer
  useEffect(() => {
    for (const s of allSessions) {
      if (s.status === "ended" && !sleepingSessionIds.has(s.id) && !sleepTimers.current.has(s.id)) {
        // Mark as sleeping
        setSleepingSessionIds((prev) => new Set([...prev, s.id]));
        // After 4 seconds, remove from live view
        const timer = setTimeout(() => {
          setSleepingSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(s.id);
            return next;
          });
          sleepTimers.current.delete(s.id);
        }, 4000);
        sleepTimers.current.set(s.id, timer);
      }
      // Resume: if a session comes back to active while sleeping, cancel removal
      if (s.status === "active" && sleepTimers.current.has(s.id)) {
        clearTimeout(sleepTimers.current.get(s.id));
        sleepTimers.current.delete(s.id);
        setSleepingSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(s.id);
          return next;
        });
      }
    }
  }, [allSessions]);

  // Live = active + idle + sleeping (still showing)
  const liveSessions = useMemo(() =>
    visibleSessions.filter((s) => s.status !== "ended" || sleepingSessionIds.has(s.id)),
    [visibleSessions, sleepingSessionIds]
  );
  const endedSessions = useMemo(() =>
    visibleSessions.filter((s) => s.status === "ended" && !sleepingSessionIds.has(s.id)),
    [visibleSessions, sleepingSessionIds]
  );

  const sortedLiveSessions = useMemo(
    () => sortByAttention(liveSessions, (s) => s.agents.map((a) => a.displayState)),
    [liveSessions]
  );

  const projectGroups = useMemo(() => groupByProject(sortedLiveSessions), [sortedLiveSessions]);

  const promptHistory = useWorkshopStore((s) => s.promptHistory);

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
        {!isDemoMode() && <RoomBackdrop />}

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
              const projectPrompts = projectSessions.reduce<import("../store/useWorkshopStore.js").PromptEntry[]>((best, s) => {
                const h = promptHistory[s.id];
                return h && h.length > 0 ? h : best;
              }, []);
              const projectPrompt = projectPrompts[0]?.text ?? null;
              return (
                <div key={projectId} className="project-group">
                  <ProjectSign
                    name={displayNames[projectId] ?? projects[projectId]?.name ?? "unknown"}
                    color={projectColor(projectSessions, isDark)}
                  />
                  <div className="project-desks">
                    {/* User desk hidden in demo mode — no real user avatar */}
                    {!isDemoMode() && (
                      <div className="project-user-desk">
                        <UserDesk latestPrompt={projectPrompt} promptHistory={projectPrompts} nowMs={nowMs} avatar={avatar} onEditAvatar={() => setShowWizard(true)} />
                      </div>
                    )}
                    <AnimatePresence>
                      {projectSessions.map((session) => (
                        <DeskArea
                          key={session.id}
                          session={session}
                          projectName={displayNames[session.projectId] ?? "unknown"}
                          latestPrompt={promptHistory[session.id]?.[0]?.text ?? null}
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

      {showWizard && !isDemoMode() && (
        <AvatarWizard initial={avatar} onSave={handleSaveAvatar} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
