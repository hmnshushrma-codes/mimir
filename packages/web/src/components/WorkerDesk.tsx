import { useState } from "react";
import { motion } from "framer-motion";
import type { SerializedAgent } from "@agent-workshop/shared";
import { Character } from "../characters/Character.js";
import { nameFor } from "../characters/names.js";
import { roleFor } from "../characters/faceFeatures.js";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { useIsDaytime } from "../hooks/useTimeOfDay.js";
import { getProfile, moodToState, type CharacterProfile } from "../characters/characterProfiles.js";
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

function WorkerMonitor({ profile, teamColor, monitorBg }: {
  profile: CharacterProfile; teamColor: string; monitorBg: string;
}) {
  return (
    <g>
      <rect x="46" y="78" width="42" height="34" rx="2" fill={monitorBg} stroke="#444" strokeWidth="1" />
      <rect x="63" y="112" width="8" height="6" fill="#555" />
      <rect x="57" y="117" width="20" height="2" rx="1" fill="#555" />

      {profile.monitorState === "code-scrolling" && (
        <g transform="translate(50,82)">
          <rect x="3" y="5" width="22" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="6" y="9" width="18" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="13" width="20" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="3" y="17" width="14" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="21" width="16" height="1.5" rx="0.5" fill={teamColor} opacity="0.35" />
        </g>
      )}
      {profile.monitorState === "error-text" && (
        <g transform="translate(50,82)">
          <rect x="3" y="8" width="28" height="1.5" rx="0.5" fill="#e34948" opacity="0.6" />
          <rect x="3" y="14" width="20" height="1.5" rx="0.5" fill="#e34948" opacity="0.4" />
          <rect x="3" y="20" width="14" height="1.5" rx="0.5" fill="#e34948" opacity="0.3" />
        </g>
      )}
      {(profile.monitorState === "dim" || profile.monitorState === "cursor-blinking") && (
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

function ZzzFromHead({ isDark, reducedMotion }: { isDark: boolean; reducedMotion: boolean }) {
  const color = isDark ? "#888" : "#aaa";
  if (reducedMotion) {
    return (
      <g>
        <text x="105" y="55" fill={color} fontSize="10" fontWeight="700" opacity="0.6">Z</text>
        <text x="115" y="46" fill={color} fontSize="8" fontWeight="700" opacity="0.4">z</text>
        <text x="122" y="40" fill={color} fontSize="6" fontWeight="700" opacity="0.25">z</text>
      </g>
    );
  }
  return (
    <g>
      <text x="105" y="55" fill={color} fontSize="10" fontWeight="700" opacity="0.7">
        Z<animate attributeName="y" values="55;45;55" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
      </text>
      <text x="115" y="46" fill={color} fontSize="8" fontWeight="700" opacity="0.5">
        z<animate attributeName="y" values="46;38;46" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2.2s" repeatCount="indefinite" />
      </text>
      <text x="122" y="40" fill={color} fontSize="6" fontWeight="700" opacity="0.3">
        z<animate attributeName="y" values="40;34;40" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.5s" repeatCount="indefinite" />
      </text>
    </g>
  );
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
  agent, sessionId, teamColor, selected, onSelect, reducedMotion, nowMs
}: WorkerDeskProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = usePrefersDarkMode();
  const daytime = useIsDaytime();
  const visibility = classifyAgentVisibility(agent, nowMs);
  const finished = visibility === "finished";

  const hasActiveTool = agent.activeToolCalls.length > 0;
  const charState = moodToState(agent.mood, false, hasActiveTool);
  const profile = getProfile("agent", finished ? "sleeping" : charState);
  const lampOn = (!daytime || !profile.lampDim) && !profile.lampDim;

  const deskColor = isDark ? "#332c24" : "#8e7050";
  const deskTop = isDark ? "#423a30" : "#a88860";
  const monitorBg = isDark ? "#111318" : "#1a1d24";

  const activity = agent.activeToolCalls[0];
  const activityLabel = activity
    ? `${activity.toolName} \u00b7 ${activity.target ?? "\u2026"}`
    : agent.state.lifecycle === "waiting_permission" ? "waiting for permission" : null;

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
        {/* Layer 1: Character */}
        <g transform="translate(36,18) scale(0.6)">
          <Character
            agentId={agent.id} agentType={agent.agentType} sessionId={sessionId}
            isForeman={false} mood={agent.mood} category={agent.state.category}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* Layer 2: Desk surface + monitor + props */}
        <rect x="12" y="118" width="126" height="8" rx="3" fill={deskTop} />

        <WorkerMonitor profile={profile} teamColor={teamColor} monitorBg={monitorBg} />
        <WorkerLamp on={lampOn} isDark={isDark} />

        {/* Typing hands — only when profile says so */}
        {profile.showTypingHands && !reducedMotion && (
          <g>
            <rect x="56" y="116" width="5" height="3" rx="1.5" fill={teamColor} opacity="0.45">
              <animate attributeName="y" values="116;114;116" dur="0.45s" repeatCount="indefinite" />
            </rect>
            <rect x="76" y="116" width="5" height="3" rx="1.5" fill={teamColor} opacity="0.45">
              <animate attributeName="y" values="116;114;116" dur="0.38s" repeatCount="indefinite" />
            </rect>
          </g>
        )}

        {/* Zzz from head — ONLY when sleeping */}
        {profile.showZzz && <ZzzFromHead isDark={isDark} reducedMotion={reducedMotion} />}

        {/* Error badge */}
        {profile.showErrorBadge && (
          <g>
            <circle cx="130" cy="70" r="6" fill="#e34948" opacity="0.85" />
            <text x="130" y="74" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">!</text>
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
