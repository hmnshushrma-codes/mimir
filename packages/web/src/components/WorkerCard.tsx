import { useState } from "react";
import { motion } from "framer-motion";
import type { SerializedAgent } from "@agent-workshop/shared";
import { Character } from "../characters/Character.js";
import { nameFor } from "../characters/names.js";
import { roleFor } from "../characters/faceFeatures.js";
import { classifyAgentVisibility } from "../characters/agentVisibility.js";

function roleLabel(agentId: string, agentType: string | null): string {
  const role = roleFor(agentId, agentType);
  switch (role) {
    case "explore":
      return "Explore";
    case "plan":
      return "Plan";
    case "general-purpose":
      return "general-purpose";
    case "foreman":
      return "Foreman";
    default:
      return agentType ?? "Agent";
  }
}

function currentActivityLabel(agent: SerializedAgent): string | null {
  const active = agent.activeToolCalls[0];
  if (active) return `${active.toolName} · ${active.target ?? "…"}`;
  if (agent.state.lifecycle === "waiting_permission") return "waiting for permission";
  if (agent.state.lifecycle === "error") return agent.state.lastError ?? "error";
  return null;
}

export function WorkerCard({
  agent,
  sessionId,
  selected,
  onSelect,
  reducedMotion,
  nowMs
}: {
  agent: SerializedAgent;
  sessionId: string;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
  nowMs: number;
}) {
  const [hovered, setHovered] = useState(false);
  const visibility = classifyAgentVisibility(agent, nowMs);
  const finished = visibility === "finished";
  const activity = currentActivityLabel(agent);

  return (
    <motion.div
      initial={reducedMotion ? false : { x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: finished ? 0.45 : 1 }}
      exit={reducedMotion ? { opacity: 0 } : { x: 60, opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={`worker-card ${selected ? "selected" : ""} ${finished ? "finished" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-agent-id={agent.id}
    >
      <Character
        agentId={agent.id}
        agentType={agent.agentType}
        sessionId={sessionId}
        isForeman={false}
        mood={agent.mood}
        category={agent.state.category}
        scale={0.8}
        reducedMotion={reducedMotion}
      />
      <div className="bench-nameplate">
        {nameFor(agent.id)} · {roleLabel(agent.id, agent.agentType)}
      </div>
      {agent.taskDescription && <div className="bench-task">{agent.taskDescription}</div>}
      {activity && <div className="bench-activity">{activity}</div>}
      {reducedMotion && <div className="badge">{agent.mood}</div>}
      {hovered && activity && <div className="bench-tooltip">{activity}</div>}
    </motion.div>
  );
}
