import { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MAIN_AGENT_ID, type SerializedSession } from "@agent-workshop/shared";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { teamColorFor } from "../characters/teamColor.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { ForemanDesk } from "./ForemanDesk.js";
import { WorkerDesk } from "./WorkerDesk.js";
import { ConnectorLines } from "./ConnectorLines.js";

const MAX_VISIBLE_WORKERS = 6;

export interface DeskAreaProps {
  session: SerializedSession;
  projectName: string;
  latestPrompt: string | null;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onFocus: () => void;
  focused: boolean;
  reducedMotion: boolean;
  nowMs: number;
}

export function DeskArea({
  session,
  projectName,
  latestPrompt,
  selectedAgentId,
  onSelectAgent,
  onFocus,
  focused,
  reducedMotion,
  nowMs
}: DeskAreaProps) {
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

  const visibleWorkers = active.slice(0, MAX_VISIBLE_WORKERS);
  const overflowCount = active.length - MAX_VISIBLE_WORKERS;

  const delegatingAgentIds = useMemo(() => {
    const ids = new Set<string>();
    if (main?.mood === "excited" && main.state.category === "delegate") {
      for (const a of active) ids.add(a.id);
    }
    for (const a of active) {
      if (a.mood === "excited" && a.state.category === "delegate") ids.add(a.id);
    }
    return ids;
  }, [active, main]);

  // Agents that just finished — proud mood = result blob goes back to foreman
  const returningAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of [...active, ...finished]) {
      if (a.mood === "proud") ids.add(a.id);
    }
    return ids;
  }, [active, finished]);

  return (
    <motion.div
      className={`desk-area ${focused ? "desk-area-focused" : ""}`}
      style={{ borderColor: teamColor }}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Focus button */}
      <button className="desk-area-focus-btn" onClick={onFocus} title={focused ? "Unfocus" : "Focus"}>
        {focused ? "\u2715" : "\u2690"}
      </button>

      <div className="desk-area-floor" ref={containerRef}>
        <ConnectorLines
          containerRef={containerRef}
          foremanRef={foremanRef}
          subagentRefs={subagentRefs}
          color={teamColor}
          delegatingAgentIds={delegatingAgentIds}
          returningAgentIds={returningAgentIds}
        />

        {/* Foreman desk */}
        {main && (
          <div ref={foremanRef} className="desk-area-foreman">
            <ForemanDesk
              agent={main}
              sessionId={session.id}
              teamColor={teamColor}
              projectName={projectName}
              branch={session.branch}
              latestPrompt={latestPrompt}
              nowMs={nowMs}
              selected={selectedAgentId === main.id}
              onSelect={() => onSelectAgent(main.id)}
              reducedMotion={reducedMotion}
            />
          </div>
        )}

        {/* Worker desks in a semicircle / two-row layout */}
        <div className="desk-area-workers">
          <AnimatePresence>
            {visibleWorkers.map((agent) => (
              <div
                key={agent.id}
                ref={(el) => { if (el) subagentRefs.set(agent.id, el); else subagentRefs.delete(agent.id); }}
                className="desk-area-worker-slot"
              >
                <WorkerDesk
                  agent={agent}
                  sessionId={session.id}
                  teamColor={teamColor}
                  selected={selectedAgentId === agent.id}
                  onSelect={() => onSelectAgent(agent.id)}
                  reducedMotion={reducedMotion}
                  nowMs={nowMs}
                />
              </div>
            ))}
          </AnimatePresence>

          {overflowCount > 0 && (
            <div className="desk-area-overflow">+{overflowCount}</div>
          )}
        </div>
      </div>

      {/* Finished workers — resting at their desks */}
      {finished.length > 0 && (
        <div className="desk-area-finished">
          <AnimatePresence>
            {finished.map((agent) => (
              <div key={agent.id} className="desk-area-worker-slot">
                <WorkerDesk
                  agent={agent}
                  sessionId={session.id}
                  teamColor={teamColor}
                  selected={selectedAgentId === agent.id}
                  onSelect={() => onSelectAgent(agent.id)}
                  reducedMotion={reducedMotion}
                  nowMs={nowMs}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
