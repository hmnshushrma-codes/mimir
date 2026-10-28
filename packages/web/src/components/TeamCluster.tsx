import { useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { MAIN_AGENT_ID, type SerializedSession } from "@agent-workshop/shared";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { teamColorFor } from "../characters/teamColor.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { relativeTime, truncate } from "../lib/text.js";
import { ForemanCard } from "./ForemanCard.js";
import { WorkerCard } from "./WorkerCard.js";
import { ConnectorLines } from "./ConnectorLines.js";
import { WorkshopRoom } from "./WorkshopRoom.js";

export function TeamCluster({
  session,
  projectName,
  latestPrompt,
  selectedAgentId,
  onSelectAgent,
  onFocus,
  focused,
  reducedMotion,
  nowMs
}: {
  session: SerializedSession;
  projectName: string;
  latestPrompt: string | null;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onFocus: () => void;
  focused: boolean;
  reducedMotion: boolean;
  nowMs: number;
}) {
  const isDark = usePrefersDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const foremanRef = useRef<HTMLDivElement>(null);
  const subagentRefs = useRef(new Map<string, HTMLElement>()).current;

  const { colorIndex } = teamColorFor(session.id);
  const palette = CHARACTER_PALETTE[colorIndex % CHARACTER_PALETTE.length];
  const teamColor = isDark ? palette.dark : palette.light;

  const main = session.agents.find((a) => a.id === MAIN_AGENT_ID) ?? null;
  const subagents = session.agents.filter((a) => a.id !== MAIN_AGENT_ID);

  const active = useMemo(() => subagents.filter((a) => classifyAgentVisibility(a, nowMs) === "active"), [subagents, nowMs]);
  const finished = useMemo(() => subagents.filter((a) => classifyAgentVisibility(a, nowMs) === "finished"), [subagents, nowMs]);

  // Agents the foreman is currently delegating to (excited mood = just spawned)
  const delegatingAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of active) {
      if (a.mood === "excited" && a.state.category === "delegate") ids.add(a.id);
    }
    // Also mark agents whose foreman is in "excited" delegate state
    if (main?.mood === "excited" && main.state.category === "delegate") {
      for (const a of active) ids.add(a.id);
    }
    return ids;
  }, [active, main]);

  return (
    <div className={`team-cluster ${focused ? "focused" : ""}`} style={{ borderColor: teamColor }}>
      <div className="cluster-header">
        <span className="cluster-header-project" style={{ color: teamColor }}>
          {projectName}
        </span>
        {session.branch && <span className="muted"> · {session.branch}</span>}
        {latestPrompt && <span className="muted"> · "{truncate(latestPrompt, 50)}"</span>}
        <span className="muted"> · {relativeTime(session.startedAt, nowMs)}</span>
        <button className="tab-button focus-button" onClick={onFocus}>
          {focused ? "Unfocus" : "Focus"}
        </button>
      </div>

      <WorkshopRoom teamColor={teamColor}>
      <div className="cluster-floor" ref={containerRef}>
        <ConnectorLines containerRef={containerRef} foremanRef={foremanRef} subagentRefs={subagentRefs} color={teamColor} delegatingAgentIds={delegatingAgentIds} />
        {main && (
          <div ref={foremanRef} style={{ position: "relative", zIndex: 1 }}>
            <ForemanCard
              agent={main}
              sessionId={session.id}
              latestPrompt={null}
              selected={selectedAgentId === main.id}
              onSelect={() => onSelectAgent(main.id)}
              reducedMotion={reducedMotion}
            />
          </div>
        )}
        <div className="worker-grid">
          <AnimatePresence>
            {active.map((agent) => (
              <div
                key={agent.id}
                ref={(el) => {
                  if (el) subagentRefs.set(agent.id, el);
                  else subagentRefs.delete(agent.id);
                }}
                style={{ position: "relative", zIndex: 1 }}
              >
                <WorkerCard
                  agent={agent}
                  sessionId={session.id}
                  selected={selectedAgentId === agent.id}
                  onSelect={() => onSelectAgent(agent.id)}
                  reducedMotion={reducedMotion}
                  nowMs={nowMs}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {finished.length > 0 && (
        <div className="finished-shelf">
          <span className="muted">Finished</span>
          <div className="worker-grid compact">
            <AnimatePresence>
              {finished.map((agent) => (
                <WorkerCard
                  key={agent.id}
                  agent={agent}
                  sessionId={session.id}
                  selected={selectedAgentId === agent.id}
                  onSelect={() => onSelectAgent(agent.id)}
                  reducedMotion={reducedMotion}
                  nowMs={nowMs}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      </WorkshopRoom>
    </div>
  );
}
