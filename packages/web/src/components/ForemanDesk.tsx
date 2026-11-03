import { useState } from "react";
import type { SerializedAgent, ActionCategory } from "@agent-workshop/shared";
import { RiggedCharacter } from "../rig/RiggedCharacter.js";
import { useStableBehaviour } from "../rig/useStableBehaviour.js";
import { buildBehaviourContext } from "../rig/agentBehaviourContext.js";
import { contrastCapColor } from "../characters/colorUtils.js";
import type { PropsConfig } from "../rig/types.js";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode.js";
import { useIsDaytime } from "../hooks/useTimeOfDay.js";
import { AgentTooltip } from "./AgentTooltip.js";
import { StateLabel } from "./StateLabel.js";
import { useWorkshopStore } from "../store/useWorkshopStore.js";

const INK = "#1b1d23";

function ToolIcon({ category }: { category: ActionCategory | null }) {
  switch (category) {
    case "read":
      return (<g transform="scale(0.7)"><circle cx="8" cy="8" r="6" fill="none" stroke="#fff" strokeWidth="1.5" /><line x1="12" y1="12" x2="16" y2="16" stroke="#fff" strokeWidth="1.5" /></g>);
    case "write":
      return (<g transform="scale(0.7)"><path d="M3,14 L3,17 L6,17 L15,8 L12,5 Z" fill="none" stroke="#fff" strokeWidth="1.2" /></g>);
    case "shell":
      return (<g transform="scale(0.7)"><rect x="1" y="3" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.2" /><polyline points="5,8 9,11 5,14" fill="none" stroke="#fff" strokeWidth="1.2" /></g>);
    case "web":
      return (<g transform="scale(0.7)"><circle cx="10" cy="10" r="8" fill="none" stroke="#fff" strokeWidth="1.2" /><ellipse cx="10" cy="10" rx="4" ry="8" fill="none" stroke="#fff" strokeWidth="0.8" /></g>);
    default: return null;
  }
}

function Monitor({
  monitorContent,
  teamColor,
  category,
  monitorBg
}: {
  monitorContent: PropsConfig["monitorContent"];
  teamColor: string;
  category: ActionCategory | null;
  monitorBg: string;
}) {
  return (
    <g>
      <rect x="70" y="100" width="60" height="44" rx="3" fill={monitorBg} stroke={INK} strokeWidth="1.5" />
      <rect x="96" y="144" width="8" height="5" fill="#555" />
      <rect x="88" y="148" width="24" height="3" rx="1.5" fill="#555" />

      {monitorContent === "code" && (
        <g transform="translate(74,104)">
          <rect x="4" y="4" width="38" height="2" rx="1" fill={teamColor} opacity="0.7" />
          <rect x="8" y="8" width="28" height="2" rx="1" fill={teamColor} opacity="0.5" />
          <rect x="8" y="12" width="34" height="2" rx="1" fill={teamColor} opacity="0.6" />
          <rect x="4" y="16" width="20" height="2" rx="1" fill={teamColor} opacity="0.4" />
          <rect x="8" y="20" width="30" height="2" rx="1" fill={teamColor} opacity="0.5" />
          <g transform="translate(32,18)"><ToolIcon category={category} /></g>
        </g>
      )}
      {monitorContent === "book-page" && (
        <g transform="translate(74,104)">
          <rect x="4" y="2" width="38" height="24" rx="1" fill="#fff" opacity="0.1" />
        </g>
      )}
      {monitorContent === "awaiting-prompt" && (
        // A large blinking ">_" prompt cursor — distinct from "thinking" at a
        // glance, since this is "waiting on you", not "working on something".
        <g transform="translate(74,104)">
          <text x="4" y="24" fontSize="16" fontFamily="monospace" fill={teamColor} opacity="0.8">
            {">"}
          </text>
          <rect x="18" y="14" width="9" height="14" fill={teamColor} opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
      {monitorContent === "done-check" && (
        <g transform="translate(100,122)">
          <circle r="11" fill={teamColor} opacity="0.25" />
          <path d="M-5 0 L-1 5 L6 -6" stroke={teamColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {monitorContent === "dim" && (
        <g transform="translate(74,104)">
          <rect x="4" y="18" width="6" height="2" rx="1" fill={teamColor} opacity="0.15" />
        </g>
      )}
    </g>
  );
}

function DeskLamp({ on, isDark }: { on: boolean; isDark: boolean }) {
  return (
    <g transform="translate(155, 108)">
      <ellipse cx="0" cy="40" rx="10" ry="3" fill="#555" />
      <line x1="0" y1="40" x2="-5" y2="18" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="-5" y1="18" x2="5" y2="0" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M-2,-2 L-10,8 L20,8 L12,-2 Z" fill="#444" />
      <circle cx="5" cy="6" r="3" fill={on ? "#f5c842" : (isDark ? "#555" : "#888")} opacity={on ? 0.9 : 0.3} />
      {on && <path d="M-8,8 L-18,38 L28,38 L18,8 Z" fill="rgba(245,200,66,0.06)" />}
    </g>
  );
}

function PhoneInHand({ teamColor }: { teamColor: string }) {
  return (
    <g transform="translate(30, 118) rotate(-10)">
      {/* Hand */}
      <ellipse cx="10" cy="24" rx="8" ry="5" fill={teamColor} opacity="0.3" />
      {/* Phone body */}
      <rect x="2" y="0" width="16" height="26" rx="3" fill="#1a1a1a" stroke="#333" strokeWidth="0.8" />
      {/* Screen */}
      <rect x="4" y="3" width="12" height="18" rx="1.5" fill="#3a6da8" opacity="0.6" />
      {/* Scrolling content */}
      <rect x="6" y="6" width="8" height="1.2" rx="0.5" fill="#fff" opacity="0.35">
        <animate attributeName="y" values="6;16;6" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x="6" y="10" width="6" height="1.2" rx="0.5" fill="#fff" opacity="0.25">
        <animate attributeName="y" values="10;20;10" dur="3.2s" repeatCount="indefinite" />
      </rect>
      {/* Thumb tap */}
      <ellipse cx="10" cy="22" rx="4" ry="2.5" fill={teamColor} opacity="0.25">
        <animate attributeName="ry" values="2.5;2;2.5" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
    </g>
  );
}

function Signs({ yes, no }: { yes: boolean; no: boolean }) {
  return (
    <g transform="translate(48, 90)">
      {yes && (
        <g>
          <rect x="0" y="0" width="30" height="20" rx="2" fill="#1baf7a" stroke="#fff" strokeWidth="1" />
          <text x="15" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">YES</text>
        </g>
      )}
      {no && (
        <g transform="translate(74,0)">
          <rect x="0" y="0" width="30" height="20" rx="2" fill="#e34948" stroke="#fff" strokeWidth="1" />
          <text x="15" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">NO</text>
        </g>
      )}
    </g>
  );
}

export interface ForemanDeskProps {
  agent: SerializedAgent;
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
  agent, teamColor, projectName, branch, latestPrompt, nowMs,
  selected, onSelect, reducedMotion
}: ForemanDeskProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = usePrefersDarkMode();
  const daytime = useIsDaytime();
  const debugOverlayEnabled = useWorkshopStore((s) => s.debugOverlayEnabled);
  const capColor = contrastCapColor(teamColor);

  const behaviourContext = buildBehaviourContext(agent, { isForeman: true, teamColor, capColor, nowMs });
  const behaviour = useStableBehaviour(behaviourContext);
  const activeCategory = behaviourContext.category;
  const lampOn = !daytime || !behaviour.props.lampDim;

  const deskColor = isDark ? "#3a3228" : "#9e7e5a";
  const deskTop = isDark ? "#4a4238" : "#b89870";
  const monitorBg = isDark ? "#111318" : "#1a1d24";
  const nameplateColor = isDark ? "#c9a84c" : "#d4a843";
  const nameLabel = projectName.length > 18 ? projectName.slice(0, 17) + "…" : projectName;
  const branchLabel = branch ? (branch.length > 14 ? branch.slice(0, 13) + "…" : branch) : null;

  return (
    <div
      className={`foreman-desk ${selected ? "selected" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      {debugOverlayEnabled && <StateLabel state={agent.displayState} reason={agent.displayReason} />}
      <svg width="200" height="280" viewBox="0 0 200 280">
        {/* Layer 1: Character (behind) */}
        <g transform="translate(48,30) scale(0.75)">
          <RiggedCharacter
            behaviour={behaviour}
            behaviourContext={behaviourContext}
            agentId={agent.id}
            renderProps={false}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* Layer 2: Desk surface + monitor + props */}
        <rect x="16" y="148" width="168" height="10" rx="3" fill={deskTop} />

        <Monitor monitorContent={behaviour.props.monitorContent} teamColor={teamColor} category={activeCategory} monitorBg={monitorBg} />
        <DeskLamp on={lampOn} isDark={isDark} />

        {/* Phone in hand when idle */}
        {behaviour.props.showPhone && behaviour.props.phonePosition === "in-hand" && (
          <PhoneInHand teamColor={teamColor} />
        )}

        {/* YES/NO permission signs */}
        {behaviour.props.signs && <Signs yes={behaviour.props.signs.yes} no={behaviour.props.signs.no} />}

        {/* Coffee mug */}
        {behaviour.props.showMug && (
          <g transform="translate(24, 136)">
            <rect x="0" y="0" width="10" height="12" rx="2" fill={isDark ? "#c06030" : "#e07040"} />
            <rect x="10" y="3" width="5" height="4" rx="2" fill={isDark ? "#c06030" : "#e07040"} />
          </g>
        )}

        {/* Keyboard */}
        <rect x="78" y="152" width="44" height="5" rx="2" fill="#555" opacity="0.6" />

        {/* Typing hands — a decorative overlay since the character's own
            arms sit behind the desk front panel at this z-order. */}
        {behaviour.activityLoop === "typing" && !reducedMotion && (
          <g>
            <rect x="84" y="149" width="6" height="4" rx="2" fill={teamColor} opacity="0.5">
              <animate attributeName="y" values="149;147;149" dur="0.4s" repeatCount="indefinite" />
            </rect>
            <rect x="110" y="149" width="6" height="4" rx="2" fill={teamColor} opacity="0.5">
              <animate attributeName="y" values="149;147;149" dur="0.35s" repeatCount="indefinite" />
            </rect>
          </g>
        )}

        {/* Layer 3: Desk front + nameplate */}
        <rect x="20" y="158" width="160" height="42" rx="2" fill={deskColor} />
        <rect x="28" y="200" width="8" height="30" rx="2" fill={deskColor} opacity="0.8" />
        <rect x="164" y="200" width="8" height="30" rx="2" fill={deskColor} opacity="0.8" />

        <rect x="46" y="165" width="108" height="28" rx="3" fill={nameplateColor} opacity="0.85" />
        <rect x="48" y="167" width="104" height="24" rx="2" fill={nameplateColor} opacity="0.5" />
        <text x="100" y="180" textAnchor="middle" fill={INK} fontSize="8" fontWeight="700" fontFamily="sans-serif">{nameLabel}</text>
        {branchLabel && (
          <text x="100" y="188" textAnchor="middle" fill={INK} fontSize="6" opacity="0.7" fontFamily="sans-serif">{branchLabel}</text>
        )}
      </svg>

      <div className="desk-label">Foreman</div>
      {hovered && <AgentTooltip agent={agent} latestPrompt={latestPrompt} nowMs={nowMs} />}
    </div>
  );
}
