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

function WorkerLaptop({ monitorContent, teamColor, monitorBg }: {
  monitorContent: PropsConfig["monitorContent"]; teamColor: string; monitorBg: string;
}) {
  return (
    <g>
      {/* Laptop body */}
      <rect x="46" y="78" width="42" height="30" rx="2" fill={monitorBg} />
      {/* Screen content */}
      {monitorContent === "code" && (
        <g transform="translate(50,82)">
          <rect x="2" y="3" width="22" height="1.2" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="5" y="7" width="16" height="1.2" rx="0.5" fill={teamColor} opacity="0.4" />
          <rect x="5" y="11" width="18" height="1.2" rx="0.5" fill={teamColor} opacity="0.5" />
          <rect x="2" y="15" width="12" height="1.2" rx="0.5" fill={teamColor} opacity="0.35" />
        </g>
      )}
      {monitorContent === "done-check" && (
        <g transform="translate(67,93)">
          <circle r="6" fill={teamColor} opacity="0.25" />
          <path d="M-3 0 L-1 2.5 L3.5 -3.5" stroke={teamColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      )}
      {(monitorContent === "dim" || monitorContent === "awaiting-prompt" || monitorContent === "book-page") && (
        <g transform="translate(50,82)">
          <rect x="2" y="12" width="4" height="1.2" rx="0.5" fill={teamColor} opacity="0.12" />
        </g>
      )}
      {/* Laptop base — sits on desk surface (y=118) */}
      <path d="M44,108 L90,108 L87,117 L47,117 Z" fill="#414141" />
      <rect x="58" y="113" width="18" height="2" rx="1" fill="#555" />
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
  const lampOn = !behaviour.props.lampDim;

  const deskColor = isDark ? "#332c24" : "#8e7050";
  const deskTop = isDark ? "#423a30" : "#a88860";
  const monitorBg = isDark ? "#111318" : "#1a1d24";

  const activity = agent.activeToolCalls[0];
  const activityLabel = activity
    ? `${activity.toolName} · ${activity.target ?? "…"}`
    : agent.displayState === "needs_permission" ? "waiting for permission" : null;

  const needsPermission = behaviour.props.signs?.yes || behaviour.props.signs?.no;
  const isIdle = behaviour.activityLoop === null && !needsPermission;
  const isTyping = behaviour.activityLoop === "typing";

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
      <svg width="150" height="220" viewBox="0 0 150 220" overflow="visible">

        {/* Layer 1: Torso with breathing */}
        <g>
          {!reducedMotion && (
            <animateTransform attributeName="transform" type="scale"
              values="1,1; 1,0.988; 1,1" dur="3.4s" repeatCount="indefinite" additive="sum" />
          )}
          <path
            d={`M42,118 C43,98 48,82 57,76 C66,70 78,68 86,72 C94,76 100,88 101,98 L103,118 Z`}
            fill={teamColor}
          />
          <ellipse cx="72" cy="86" rx="10" ry="9" fill="#fff" opacity="0.12" />
        </g>

        {/* Head */}
        <g transform="translate(30,14) scale(0.62)">
          <RiggedCharacter
            behaviour={behaviour}
            behaviourContext={behaviourContext}
            agentId={agent.id}
            renderProps={false}
            renderArms={false}
            reducedMotion={reducedMotion}
          />
        </g>

        {/* Layer 2: Arms with idle sway */}
        <g>
          {!reducedMotion && isIdle && (
            <animateTransform attributeName="transform" type="rotate"
              values="0 53 76; 2 53 76; 0 53 76; -1 53 76; 0 53 76" dur="4.2s" repeatCount="indefinite" />
          )}
          <path
            d={`M53,76 C48,75 45,80 44,88 L42,104 C41,109 43,113 47,113 C51,113 53,109 53,105 L55,89 C56,82 55,77 53,76 Z`}
            fill={teamColor}
          />
        </g>
        <g>
          {!reducedMotion && isIdle && (
            <animateTransform attributeName="transform" type="rotate"
              values="0 91 76; -1 91 76; 0 91 76; 2 91 76; 0 91 76" dur="4.5s" repeatCount="indefinite" />
          )}
          <path
            d={`M91,76 C96,75 99,80 100,88 L102,104 C103,109 101,113 97,113 C93,113 91,109 91,105 L89,89 C88,82 89,77 91,76 Z`}
            fill={teamColor}
          />
        </g>

        {/* Layer 3: Laptop */}
        <WorkerLaptop monitorContent={behaviour.props.monitorContent} teamColor={teamColor} monitorBg={monitorBg} />
        <ellipse cx="67" cy="113" rx="22" ry="2" fill="#000" opacity="0.1" />

        {/* Layer 4: Hands with idle fidget / typing bounce */}
        <path d="M43,104 C42,108 43,112 47,112 C51,112 53,109 52,105" fill={teamColor} />
        <path d="M92,105 C91,109 93,112 97,112 C101,112 102,108 101,104" fill={teamColor} />
        <ellipse cx="47" cy="111" rx="4.5" ry="4.5" fill="#f6c98b">
          {!reducedMotion && isTyping && (
            <animate attributeName="cy" values="111;108;111" dur="0.4s" repeatCount="indefinite" />
          )}
          {!reducedMotion && isIdle && (
            <animate attributeName="cx" values="47;46;47;48;47" dur="5s" repeatCount="indefinite" />
          )}
        </ellipse>
        <ellipse cx="97" cy="111" rx="4.5" ry="4.5" fill="#f6c98b">
          {!reducedMotion && isTyping && (
            <animate attributeName="cy" values="111;108;111" dur="0.35s" repeatCount="indefinite" />
          )}
          {!reducedMotion && isIdle && (
            <animate attributeName="cx" values="97;98;97;96;97" dur="5.3s" repeatCount="indefinite" />
          )}
        </ellipse>
        <ellipse cx="47" cy="114" rx="4" ry="1.5" fill="#000" opacity="0.06" />
        <ellipse cx="97" cy="114" rx="4" ry="1.5" fill="#000" opacity="0.06" />

        {/* YES/NO signs */}
        {needsPermission && (
          <>
            {behaviour.props.signs?.yes && (
              <g transform="translate(32, 96)">
                <rect x="0" y="0" width="22" height="13" rx="2" fill="#1baf7a" stroke="#fff" strokeWidth="0.8" />
                <text x="11" y="10" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">YES</text>
              </g>
            )}
            {behaviour.props.signs?.no && (
              <g transform="translate(90, 96)">
                <rect x="0" y="0" width="22" height="13" rx="2" fill="#e34948" stroke="#fff" strokeWidth="0.8" />
                <text x="11" y="10" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">NO</text>
              </g>
            )}
          </>
        )}

        {/* Layer 5: Desk + props */}
        <WorkerLamp on={lampOn} isDark={isDark} />

        <rect x="12" y="118" width="126" height="8" rx="3" fill={deskTop} />

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
