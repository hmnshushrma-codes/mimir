import { useState } from "react";
import type { SerializedAgent } from "@agent-workshop/shared";
import { Character } from "../characters/Character.js";
import { SpeechBubble } from "./SpeechBubble.js";

export function ForemanCard({
  agent,
  sessionId,
  latestPrompt,
  selected,
  onSelect,
  reducedMotion
}: {
  agent: SerializedAgent;
  sessionId: string;
  latestPrompt: string | null;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const active = agent.activeToolCalls[0];

  return (
    <div
      className={`foreman-card ${selected ? "selected" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <Character
        agentId={agent.id}
        agentType={agent.agentType}
        sessionId={sessionId}
        isForeman
        mood={agent.mood}
        category={agent.state.category}
        scale={1.1}
        reducedMotion={reducedMotion}
      />
      <div className="bench-nameplate">Foreman</div>
      {reducedMotion && <div className="badge">{agent.mood}</div>}
      {latestPrompt && <SpeechBubble text={latestPrompt} />}
      {hovered && active && (
        <div className="bench-tooltip">
          {active.toolName} · {active.target ?? "…"}
        </div>
      )}
    </div>
  );
}
