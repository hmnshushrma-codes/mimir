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

function LaptopScreen({
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
      {/* Laptop body */}
      <rect x="67" y="96" width="66" height="42" rx="3" fill={monitorBg} />
      {/* Screen content */}
      {monitorContent === "code" && (
        <g transform="translate(71,100)">
          <rect x="3" y="3" width="34" height="1.5" rx="0.5" fill={teamColor} opacity="0.6" />
          <rect x="6" y="7" width="24" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="6" y="11" width="30" height="1.5" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="3" y="15" width="18" height="1.5" rx="0.5" fill={teamColor} opacity="0.35" />
          <rect x="6" y="19" width="26" height="1.5" rx="0.5" fill={teamColor} opacity="0.4" />
          <g transform="translate(38,14)"><ToolIcon category={category} /></g>
        </g>
      )}
      {monitorContent === "awaiting-prompt" && (
        <g transform="translate(71,100)">
          <text x="4" y="22" fontSize="14" fontFamily="monospace" fill={teamColor} opacity="0.8">{">"}</text>
          <rect x="16" y="12" width="8" height="12" fill={teamColor} opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
      {monitorContent === "done-check" && (
        <g transform="translate(100,117)">
          <circle r="9" fill={teamColor} opacity="0.25" />
          <path d="M-4 0 L-1 4 L5 -5" stroke={teamColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {(monitorContent === "dim" || monitorContent === "book-page") && (
        <g transform="translate(71,100)">
          <rect x="3" y="16" width="5" height="1.5" rx="0.5" fill={teamColor} opacity="0.12" />
        </g>
      )}
      {/* Laptop base — sits on desk surface (y=148) */}
      <path d="M65,138 L135,138 L131,147 L69,147 Z" fill="#414141" />
      <rect x="83" y="143" width="34" height="3" rx="1.5" fill="#555" />
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
      <ellipse cx="10" cy="24" rx="8" ry="5" fill={teamColor} opacity="0.3" />
      <rect x="2" y="0" width="16" height="26" rx="3" fill="#1a1a1a" stroke="#333" strokeWidth="0.8" />
      <rect x="4" y="3" width="12" height="18" rx="1.5" fill="#3a6da8" opacity="0.6" />
      <rect x="6" y="6" width="8" height="1.2" rx="0.5" fill="#fff" opacity="0.35">
        <animate attributeName="y" values="6;16;6" dur="3s" repeatCount="indefinite" />
      </rect>
      <ellipse cx="10" cy="22" rx="4" ry="2.5" fill={teamColor} opacity="0.25">
        <animate attributeName="ry" values="2.5;2;2.5" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
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

  const needsPermission = behaviour.props.signs?.yes || behaviour.props.signs?.no;
  const isIdle = behaviour.activityLoop === null && !needsPermission && !behaviour.eyesClosed;
  const isTyping = behaviour.activityLoop === "typing";

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
      <svg width="200" height="280" viewBox="0 0 200 280" overflow="visible">

        {/* ===== Layer 1: Mascot body ===== */}
        {/* Torso */}
        <path
          d={`M58,148 C59,122 65,100 78,92 C91,84 109,84 122,92 C135,100 141,122 142,148 Z`}
          fill={teamColor}
        />
        {/* Chest highlight */}
        <ellipse cx="100" cy="108" rx="14" ry="12" fill="#fff" opacity="0.12" />

        {/* Head — with idle head turn (looks left, center, right, center) */}
        <g transform="translate(42,18) scale(0.78)">
          <RiggedCharacter
            behaviour={behaviour}
            behaviourContext={behaviourContext}
            agentId={agent.id}
            renderProps={false}
            renderArms={false}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* ===== Layer 2: Arms BEHIND laptop ===== */}
        {/* Left arm */}
        <path
          d={`M74,92 C66,91 62,97 60,108 L57,130 C56,137 59,142 64,142 C69,142 71,137 72,131 L75,110 C77,99 76,93 74,92 Z`}
          fill={teamColor}
        />
        <path
          d={`M74,92 C72,93 70,98 69,108 L67,128`}
          stroke="#000" strokeWidth="1" opacity="0.08" fill="none"
        />
        {/* Right arm */}
        <path
          d={`M126,92 C134,91 138,97 140,108 L143,130 C144,137 141,142 136,142 C131,142 129,137 128,131 L125,110 C123,99 124,93 126,92 Z`}
          fill={teamColor}
        />
        <path
          d={`M126,92 C128,93 130,98 131,108 L133,128`}
          stroke="#000" strokeWidth="1" opacity="0.08" fill="none"
        />

        {/* ===== Layer 3: Laptop (occludes inner arms + lower torso) ===== */}
        <LaptopScreen
          monitorContent={behaviour.props.monitorContent}
          teamColor={teamColor}
          category={activeCategory}
          monitorBg={monitorBg}
        />
        {/* Laptop shadow on desk */}
        <ellipse cx="100" cy="144" rx="34" ry="3" fill="#000" opacity="0.12" />

        {/* ===== Layer 4: Hands (in front of laptop base) ===== */}
        {/* Wrist transitions */}
        <path d="M58,130 C57,136 59,141 64,141 C69,141 71,137 70,132" fill={teamColor} />
        <path d="M130,132 C129,137 131,141 136,141 C141,141 143,136 142,130" fill={teamColor} />
        {/* Left hand — with idle fidget or typing bounce */}
        <ellipse cx="64" cy="140" rx="6" ry="6" fill="#f6c98b">
          {!reducedMotion && isTyping && (
            <animate attributeName="cy" values="140;137;140" dur="0.4s" repeatCount="indefinite" />
          )}
          {!reducedMotion && isIdle && (
            <animate attributeName="cx" values="64;63;64;65;64" dur="5s" repeatCount="indefinite" />
          )}
        </ellipse>
        {/* Right hand — reaches right to grab mug, lifts to face, returns */}
        <ellipse cx="136" cy="140" rx="6" ry="6" fill="#f6c98b">
          {!reducedMotion && isTyping && (
            <animate attributeName="cy" values="140;137;140" dur="0.35s" repeatCount="indefinite" />
          )}
          {!reducedMotion && isIdle && (
            <>
              <animate attributeName="cy"
                values="140;140;140;140;140;134;106;106;134;140;140;140;140"
                dur="10s" repeatCount="indefinite" />
              <animate attributeName="cx"
                values="136;136;136;136;136;148;144;144;148;136;136;136;136"
                dur="10s" repeatCount="indefinite" />
            </>
          )}
        </ellipse>
        {/* Hand shadows */}
        <ellipse cx="64" cy="144" rx="5" ry="2" fill="#000" opacity="0.06" />
        <ellipse cx="136" cy="144" rx="5" ry="2" fill="#000" opacity="0.06" />

        {/* YES/NO signs */}
        {needsPermission && (
          <>
            {behaviour.props.signs?.yes && (
              <g transform="translate(46, 122)">
                <rect x="0" y="0" width="26" height="14" rx="3" fill="#1baf7a" stroke="#fff" strokeWidth="1" />
                <text x="13" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">YES</text>
              </g>
            )}
            {behaviour.props.signs?.no && (
              <g transform="translate(128, 122)">
                <rect x="0" y="0" width="26" height="14" rx="3" fill="#e34948" stroke="#fff" strokeWidth="1" />
                <text x="13" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">NO</text>
              </g>
            )}
          </>
        )}

        {/* ===== Layer 5: Desk + props ===== */}
        <DeskLamp on={lampOn} isDark={isDark} />

        {/* Phone removed — old prop from pre-desk-rewrite layout */}

        {/* Coffee mug on desk surface, right of the right hand */}
        <g>
          {!reducedMotion && isIdle && (
            <animateTransform attributeName="transform" type="translate"
              values="0,0; 0,0; 0,0; 0,0; 0,0; 0,-6; -2,-30; -2,-30; 0,-6; 0,0; 0,0; 0,0; 0,0"
              dur="10s" repeatCount="indefinite" />
          )}
          <rect x="146" y="136" width="9" height="11" rx="2.5" fill={isDark ? "#c06030" : "#e07040"} />
          <rect x="155" y="138" width="4" height="4" rx="2" fill={isDark ? "#c06030" : "#e07040"} />
          {/* Steam wisps when mug is on desk */}
          {!reducedMotion && isIdle && (
            <>
              <line x1="148" y1="134" x2="148" y2="130" stroke={isDark ? "#666" : "#999"} strokeWidth="0.8" opacity="0.3">
                <animate attributeName="y2" values="130;126;130" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
              </line>
              <line x1="152" y1="134" x2="153" y2="129" stroke={isDark ? "#666" : "#999"} strokeWidth="0.8" opacity="0.2">
                <animate attributeName="y2" values="129;125;129" dur="2.3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2.3s" repeatCount="indefinite" />
              </line>
            </>
          )}
        </g>

        {/* Desk top */}
        <rect x="16" y="148" width="168" height="10" rx="3" fill={deskTop} />

        {/* Desk front + nameplate */}
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
