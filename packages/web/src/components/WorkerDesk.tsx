import { useState } from "react";
import { motion } from "framer-motion";
import type { SerializedAgent } from "@agent-workshop/shared";
import { RiggedCharacter } from "../rig/RiggedCharacter.js";
import { useStableBehaviour } from "../rig/useStableBehaviour.js";
import { buildBehaviourContext } from "../rig/agentBehaviourContext.js";
import { contrastCapColor } from "../characters/colorUtils.js";
import type { PropsConfig } from "../rig/types.js";
import { nameFor } from "../characters/names.js";
import { roleLabel } from "../characters/faceFeatures.js";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { AgentTooltip } from "./AgentTooltip.js";
import { StateLabel } from "./StateLabel.js";
import { useWorkshopStore } from "../store/useWorkshopStore.js";

function WorkerMonitor({ monitorContent, teamColor, monitorBg }: {
  monitorContent: PropsConfig["monitorContent"]; teamColor: string; monitorBg: string;
}) {
  return (
    <g>
      <rect x="46" y="78" width="42" height="34" rx="2" fill={monitorBg} stroke="#444" strokeWidth="1" />
      <rect x="63" y="112" width="8" height="6" fill="#555" />
      <rect x="57" y="117" width="20" height="2" rx="1" fill="#555" />

      {monitorContent === "code" && (
        <g transform="translate(50,82)">
          <rect x="3" y="5" width="22" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="6" y="9" width="18" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="13" width="20" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="3" y="17" width="14" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="21" width="16" height="1.5" rx="0.5" fill={teamColor} opacity="0.35" />
        </g>
      )}
      {monitorContent === "book-page" && (
        <g transform="translate(50,82)">
          <rect x="3" y="2" width="28" height="22" rx="1" fill="#fff" opacity="0.1" />
        </g>
      )}
      {monitorContent === "done-check" && (
        <g transform="translate(67,95)">
          <circle r="8" fill={teamColor} opacity="0.25" />
          <path d="M-4 0 L-1 3.5 L4.5 -4.5" stroke={teamColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {(monitorContent === "dim" || monitorContent === "awaiting-prompt") && (
        <g transform="translate(50,82)">
          <rect x="3" y="14" width="5" height="1.5" rx="0.5" fill={teamColor} opacity="0.12" />
        </g>
      )}
    </g>
  );
}

function WorkerLamp({ on, isDark }: { on: boolean; isDark: boolean }) {
  return (
    <g transform="translate(120, 82)">
      <ellipse cx="0" cy="32" rx="7" ry="2.5" fill="#555" />
      <line x1="0" y1="32" x2="-3" y2="14" stroke="#666" strokeWidth="2" strokeLinecap="round" />
      <line x1="-3" y1="14" x2="4" y2="0" stroke="#666" strokeWidth="2" strokeLinecap="round" />
      <path d="M0,-2 L-7,6 L15,6 L8,-2 Z" fill="#444" />
      <circle cx="4" cy="4" r="2.5" fill={on ? "#f5c842" : (isDark ? "#555" : "#888")} opacity={on ? 0.9 : 0.3} />
      {on && <path d="M-5,6 L-12,30 L20,30 L13,6 Z" fill="rgba(245,200,66,0.05)" />}
    </g>
  );
}

function Signs({ yes, no }: { yes: boolean; no: boolean }) {
  return (
    <g transform="translate(34, 58)">
      {yes && (
        <g>
          <rect x="0" y="0" width="22" height="15" rx="2" fill="#1baf7a" stroke="#fff" strokeWidth="1" />
          <text x="11" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">YES</text>
        </g>
      )}
      {no && (
        <g transform="translate(60,0)">
          <rect x="0" y="0" width="22" height="15" rx="2" fill="#e34948" stroke="#fff" strokeWidth="1" />
          <text x="11" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">NO</text>
        </g>
      )}
    </g>
  );
}

export interface WorkerDeskProps {
  agent: SerializedAgent;
  teamColor: string;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
  nowMs: number;
}

export function WorkerDesk({
  agent, teamColor, selected, onSelect, reducedMotion, nowMs
}: WorkerDeskProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = usePrefersDarkMode();
  const debugOverlayEnabled = useWorkshopStore((s) => s.debugOverlayEnabled);
  const visibility = classifyAgentVisibility(agent, nowMs);
  const finished = visibility === "finished";
  const capColor = contrastCapColor(teamColor);

  const behaviourContext = buildBehaviourContext(agent, { isForeman: false, teamColor, capColor, nowMs });
  const behaviour = useStableBehaviour(behaviourContext);
  // A resting (sleeping) worker's lamp is off regardless of time of day —
  // mirrors the old profile system's lampDim semantics for a dormant agent.
  const lampOn = !behaviour.props.lampDim;

  const deskColor = isDark ? "#332c24" : "#8e7050";
  const deskTop = isDark ? "#423a30" : "#a88860";
  const monitorBg = isDark ? "#111318" : "#1a1d24";

  const activity = agent.activeToolCalls[0];
  const activityLabel = activity
    ? `${activity.toolName} · ${activity.target ?? "…"}`
    : agent.displayState === "needs_permission" ? "waiting for permission" : null;

  return (
    <motion.div
      initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: finished ? 0.5 : 1 }}
      exit={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={`worker-desk ${selected ? "selected" : ""} ${finished ? "finished" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-agent-id={agent.id}
    >
      {debugOverlayEnabled && <StateLabel state={agent.displayState} reason={agent.displayReason} />}
      <svg width="150" height="220" viewBox="0 0 150 220">
        {/* Layer 1: Character */}
        <g transform="translate(36,18) scale(0.6)">
          <RiggedCharacter
            behaviour={behaviour}
            behaviourContext={behaviourContext}
            agentId={agent.id}
            renderProps={false}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* Layer 2: Desk surface + monitor + props */}
        <rect x="12" y="118" width="126" height="8" rx="3" fill={deskTop} />

        <WorkerMonitor monitorContent={behaviour.props.monitorContent} teamColor={teamColor} monitorBg={monitorBg} />
        <WorkerLamp on={lampOn} isDark={isDark} />

        {/* YES/NO permission signs */}
        {behaviour.props.signs && <Signs yes={behaviour.props.signs.yes} no={behaviour.props.signs.no} />}

        {/* Typing hands — decorative overlay, since the character's own arms
            sit behind the desk front panel at this z-order. */}
        {behaviour.activityLoop === "typing" && !reducedMotion && (
          <g>
            <rect x="56" y="116" width="5" height="3" rx="1.5" fill={teamColor} opacity="0.45">
              <animate attributeName="y" values="116;114;116" dur="0.45s" repeatCount="indefinite" />
            </rect>
            <rect x="76" y="116" width="5" height="3" rx="1.5" fill={teamColor} opacity="0.45">
              <animate attributeName="y" values="116;114;116" dur="0.38s" repeatCount="indefinite" />
            </rect>
          </g>
        )}

        {/* Layer 3: Desk front */}
        <rect x="15" y="126" width="120" height="32" rx="2" fill={deskColor} />
        <rect x="22" y="158" width="6" height="24" rx="2" fill={deskColor} opacity="0.8" />
        <rect x="122" y="158" width="6" height="24" rx="2" fill={deskColor} opacity="0.8" />

        <rect x="35" y="132" width="80" height="16" rx="2" fill={teamColor} opacity="0.2" />
        <text x="75" y="143" textAnchor="middle" fill={isDark ? "#ccc" : "#555"} fontSize="7" fontFamily="sans-serif">
          {roleLabel(agent.id, agent.agentType)}
        </text>
      </svg>

      <div className="desk-label">
        {nameFor(agent.id)} · {roleLabel(agent.id, agent.agentType)}
      </div>
      {activityLabel && <div className="desk-activity">{activityLabel}</div>}
      {hovered && <AgentTooltip agent={agent} nowMs={nowMs} />}
    </motion.div>
  );
}
