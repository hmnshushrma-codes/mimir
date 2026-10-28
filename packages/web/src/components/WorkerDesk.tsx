import { useState } from "react";
import { motion } from "framer-motion";
import type { SerializedAgent, ActionCategory } from "@agent-workshop/shared";
import { Character } from "../characters/Character.js";
import { nameFor } from "../characters/names.js";
import { roleFor } from "../characters/faceFeatures.js";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { AgentTooltip } from "./AgentTooltip.js";

function roleLabel(agentId: string, agentType: string | null): string {
  const role = roleFor(agentId, agentType);
  switch (role) {
    case "explore": return "Explore";
    case "plan": return "Plan";
    case "general-purpose": return "general-purpose";
    case "foreman": return "Foreman";
    default: return agentType ?? "Agent";
  }
}

/** What shows on the worker's "monitor" — depends on what they're doing. */
function WorkerMonitorContent({ category, teamColor }: { category: ActionCategory | null; teamColor: string }) {
  switch (category) {
    case "read":
      // Open book / search icon
      return (
        <g>
          {/* Book shape */}
          <path d="M4,4 L4,24 Q16,20 16,24 L16,4 Q16,8 4,4 Z" fill={teamColor} opacity="0.3" />
          <path d="M28,4 L28,24 Q16,20 16,24 L16,4 Q16,8 28,4 Z" fill={teamColor} opacity="0.4" />
          {/* Text lines */}
          <rect x="6" y="10" width="8" height="1.5" rx="0.5" fill={teamColor} opacity="0.6" />
          <rect x="6" y="14" width="6" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="18" y="10" width="8" height="1.5" rx="0.5" fill={teamColor} opacity="0.6" />
          <rect x="18" y="14" width="7" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
        </g>
      );
    case "web":
      // Radio / antenna
      return (
        <g>
          <line x1="16" y1="4" x2="16" y2="16" stroke={teamColor} strokeWidth="1.5" opacity="0.6" />
          <circle cx="16" cy="4" r="2" fill={teamColor} opacity="0.7" />
          {/* Signal waves */}
          <path d="M10,8 Q16,2 22,8" fill="none" stroke={teamColor} strokeWidth="1" opacity="0.4" />
          <path d="M7,12 Q16,-1 25,12" fill="none" stroke={teamColor} strokeWidth="1" opacity="0.25" />
          <rect x="8" y="18" width="16" height="8" rx="2" fill={teamColor} opacity="0.3" />
        </g>
      );
    case "shell":
      // Terminal
      return (
        <g>
          <rect x="2" y="4" width="28" height="20" rx="2" fill={teamColor} opacity="0.15" />
          <polyline points="5,10 9,14 5,18" fill="none" stroke={teamColor} strokeWidth="1.2" opacity="0.7" />
          <rect x="12" y="16" width="10" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="5" y="8" width="18" height="1.5" rx="0.5" fill={teamColor} opacity="0.3" />
        </g>
      );
    default:
      // Generic code lines (write, delegate, other)
      return (
        <g>
          <rect x="3" y="5" width="22" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="6" y="9" width="18" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="13" width="20" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="3" y="17" width="14" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="21" width="16" height="1.5" rx="0.5" fill={teamColor} opacity="0.35" />
        </g>
      );
  }
}

export interface WorkerDeskProps {
  agent: SerializedAgent;
  sessionId: string;
  teamColor: string;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
  nowMs: number;
}

export function WorkerDesk({
  agent,
  sessionId,
  teamColor,
  selected,
  onSelect,
  reducedMotion,
  nowMs
}: WorkerDeskProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = usePrefersDarkMode();
  const visibility = classifyAgentVisibility(agent, nowMs);
  const finished = visibility === "finished";
  const isWorking = agent.mood === "focused" || agent.mood === "concentrating" || agent.mood === "excited";
  const isResting = agent.mood === "sleepy" || agent.mood === "proud" || finished;

  const deskColor = isDark ? "#332c24" : "#8e7050";
  const deskTop = isDark ? "#423a30" : "#a88860";
  const monitorBg = isDark ? "#111318" : "#1a1d24";

  const activity = agent.activeToolCalls[0];
  const activityLabel = activity
    ? `${activity.toolName} \u00b7 ${activity.target ?? "\u2026"}`
    : agent.state.lifecycle === "waiting_permission"
      ? "waiting for permission"
      : null;

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
      <svg width="150" height="220" viewBox="0 0 150 220">
        {/* === Layer 1: Character (behind) === */}
        <g transform="translate(36,18) scale(0.6)">
          <Character
            agentId={agent.id}
            agentType={agent.agentType}
            sessionId={sessionId}
            isForeman={false}
            mood={agent.mood}
            category={agent.state.category}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* === Layer 2: Desk surface + monitor (in front of character) === */}
        {/* Desk surface */}
        <rect x="12" y="118" width="126" height="8" rx="3" fill={deskTop} />

        {/* Small monitor on desk */}
        <rect x="46" y="78" width="42" height="34" rx="2" fill={monitorBg} stroke="#444" strokeWidth="1" />
        {/* Monitor stand */}
        <rect x="63" y="112" width="8" height="6" fill="#555" />
        <rect x="57" y="117" width="20" height="2" rx="1" fill="#555" />

        {/* Monitor content */}
        {isWorking && (
          <g transform="translate(50,82)">
            <WorkerMonitorContent category={agent.state.category} teamColor={teamColor} />
          </g>
        )}
        {isResting && (
          <g>
            {/* Tea mug on desk */}
            <rect x="112" y="106" width="12" height="14" rx="2" fill={isDark ? "#6a5040" : "#c9a06a"} />
            <rect x="124" y="110" width="6" height="4" rx="2" fill={isDark ? "#6a5040" : "#c9a06a"} />
            {/* Steam */}
            <path d="M116,104 Q118,100 116,96" fill="none" stroke={isDark ? "#666" : "#aaa"} strokeWidth="0.8" opacity="0.5" />
          </g>
        )}

        {/* === Layer 3: Desk front panel (frontmost) === */}
        <rect x="15" y="126" width="120" height="32" rx="2" fill={deskColor} />
        {/* Desk legs */}
        <rect x="22" y="158" width="6" height="24" rx="2" fill={deskColor} opacity="0.8" />
        <rect x="122" y="158" width="6" height="24" rx="2" fill={deskColor} opacity="0.8" />

        {/* Role label on front panel */}
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
