import { useState } from "react";
import type { SerializedAgent, ActionCategory } from "@agent-workshop/shared";
import { Character } from "../characters/Character.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { AgentTooltip } from "./AgentTooltip.js";

const INK = "#1b1d23";

function ToolIcon({ category }: { category: ActionCategory | null }) {
  switch (category) {
    case "read":
      return (
        <g transform="translate(0,0) scale(0.7)">
          <circle cx="8" cy="8" r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
          <line x1="12" y1="12" x2="16" y2="16" stroke="#fff" strokeWidth="1.5" />
        </g>
      );
    case "write":
      return (
        <g transform="translate(0,0) scale(0.7)">
          <path d="M3,14 L3,17 L6,17 L15,8 L12,5 Z" fill="none" stroke="#fff" strokeWidth="1.2" />
        </g>
      );
    case "shell":
      return (
        <g transform="translate(0,0) scale(0.7)">
          <rect x="1" y="3" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.2" />
          <polyline points="5,8 9,11 5,14" fill="none" stroke="#fff" strokeWidth="1.2" />
          <line x1="11" y1="14" x2="15" y2="14" stroke="#fff" strokeWidth="1.2" />
        </g>
      );
    case "web":
      return (
        <g transform="translate(0,0) scale(0.7)">
          <circle cx="10" cy="10" r="8" fill="none" stroke="#fff" strokeWidth="1.2" />
          <ellipse cx="10" cy="10" rx="4" ry="8" fill="none" stroke="#fff" strokeWidth="0.8" />
          <line x1="2" y1="10" x2="18" y2="10" stroke="#fff" strokeWidth="0.8" />
        </g>
      );
    case "mcp":
      return (
        <g transform="translate(0,0) scale(0.7)">
          <rect x="5" y="2" width="10" height="16" rx="2" fill="none" stroke="#fff" strokeWidth="1.2" />
          <line x1="5" y1="5" x2="15" y2="5" stroke="#fff" strokeWidth="0.8" />
          <circle cx="10" cy="15" r="1.5" fill="#fff" />
        </g>
      );
    default:
      return null;
  }
}

/** "Code lines" that scroll on the monitor — just colored rects. */
function MonitorContent({ teamColor, category }: { teamColor: string; category: ActionCategory | null }) {
  return (
    <g>
      {/* Code lines */}
      <rect x="4" y="4" width="38" height="2" rx="1" fill={teamColor} opacity="0.7" />
      <rect x="8" y="8" width="28" height="2" rx="1" fill={teamColor} opacity="0.5" />
      <rect x="8" y="12" width="34" height="2" rx="1" fill={teamColor} opacity="0.6" />
      <rect x="4" y="16" width="20" height="2" rx="1" fill={teamColor} opacity="0.4" />
      <rect x="8" y="20" width="30" height="2" rx="1" fill={teamColor} opacity="0.5" />
      <rect x="4" y="24" width="25" height="2" rx="1" fill={teamColor} opacity="0.6" />
      {/* Tool icon overlay */}
      <g transform="translate(32,18)">
        <ToolIcon category={category} />
      </g>
    </g>
  );
}

export interface ForemanDeskProps {
  agent: SerializedAgent;
  sessionId: string;
  teamColor: string;
  projectName: string;
  branch: string | null;
  latestPrompt: string | null;
  nowMs: number;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
}

export function ForemanDesk({
  agent,
  sessionId,
  teamColor,
  projectName,
  branch,
  latestPrompt,
  nowMs,
  selected,
  onSelect,
  reducedMotion
}: ForemanDeskProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = usePrefersDarkMode();
  const isIdle = agent.mood === "sleepy";
  const isWorking = agent.mood === "focused" || agent.mood === "concentrating" || agent.mood === "excited";

  const deskColor = isDark ? "#3a3228" : "#9e7e5a";
  const deskTop = isDark ? "#4a4238" : "#b89870";
  const monitorBg = isDark ? "#111318" : "#1a1d24";
  const nameplateColor = isDark ? "#c9a84c" : "#d4a843";

  // Truncate for nameplate
  const nameLabel = projectName.length > 18 ? projectName.slice(0, 17) + "\u2026" : projectName;
  const branchLabel = branch ? (branch.length > 14 ? branch.slice(0, 13) + "\u2026" : branch) : null;

  return (
    <div
      className={`foreman-desk ${selected ? "selected" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <svg width="200" height="280" viewBox="0 0 200 280">
        {/* === Layer 1: Character (behind everything) === */}
        <g transform="translate(48,30) scale(0.75)">
          <Character
            agentId={agent.id}
            agentType={agent.agentType}
            sessionId={sessionId}
            isForeman
            mood={agent.mood}
            category={agent.state.category}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* === Layer 2: Desk surface + monitor (in front of character) === */}
        {/* Desk surface */}
        <rect x="16" y="148" width="168" height="10" rx="3" fill={deskTop} />

        {/* Monitor — sits on desk surface */}
        <rect x="70" y="100" width="60" height="44" rx="3" fill={monitorBg} stroke={INK} strokeWidth="1.5" />
        {/* Monitor stand */}
        <rect x="96" y="144" width="8" height="5" fill="#555" />
        <rect x="88" y="148" width="24" height="3" rx="1.5" fill="#555" />

        {/* Monitor content */}
        {isWorking && (
          <g transform="translate(74,104)">
            <MonitorContent teamColor={teamColor} category={agent.state.category} />
          </g>
        )}
        {isIdle && (
          <g transform="translate(74,104)">
            <text x="25" y="22" textAnchor="middle" fill="#555" fontSize="14" fontFamily="sans-serif">
              Zzz
            </text>
          </g>
        )}
        {!isWorking && !isIdle && (
          <g transform="translate(74,104)">
            <rect x="4" y="18" width="6" height="2" rx="1" fill={teamColor} opacity="0.4" />
          </g>
        )}

        {/* Keyboard on desk */}
        <rect x="78" y="152" width="44" height="5" rx="2" fill="#555" opacity="0.6" />
        <rect x="80" y="153" width="40" height="1.5" rx="0.5" fill="#666" opacity="0.4" />

        {/* === Layer 3: Desk front panel + nameplate (frontmost) === */}
        <rect x="20" y="158" width="160" height="42" rx="2" fill={deskColor} />
        {/* Desk legs */}
        <rect x="28" y="200" width="8" height="30" rx="2" fill={deskColor} opacity="0.8" />
        <rect x="164" y="200" width="8" height="30" rx="2" fill={deskColor} opacity="0.8" />

        {/* Brass nameplate on front panel */}
        <rect x="46" y="165" width="108" height="28" rx="3" fill={nameplateColor} opacity="0.85" />
        <rect x="48" y="167" width="104" height="24" rx="2" fill={nameplateColor} opacity="0.5" />
        <text x="100" y="180" textAnchor="middle" fill={INK} fontSize="8" fontWeight="700" fontFamily="sans-serif">
          {nameLabel}
        </text>
        {branchLabel && (
          <text x="100" y="188" textAnchor="middle" fill={INK} fontSize="6" opacity="0.7" fontFamily="sans-serif">
            {branchLabel}
          </text>
        )}
      </svg>

      <div className="desk-label">Foreman</div>
      {hovered && (
        <AgentTooltip agent={agent} latestPrompt={latestPrompt} nowMs={nowMs} />
      )}
    </div>
  );
}
