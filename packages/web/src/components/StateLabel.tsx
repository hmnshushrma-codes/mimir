import type { DisplayState } from "@agent-workshop/shared";

/** Small debug pill showing an agent's authoritative display state + the
 *  human-readable reason computed alongside it (e.g. "working · Bash · 42s").
 *  Toggled globally via useWorkshopStore's debugOverlayEnabled flag. */
export function StateLabel({ state, reason }: { state: DisplayState; reason: string }) {
  return (
    <div className={`state-label state-label-${state}`}>
      {state}
      {reason && <span className="state-label-reason"> · {reason}</span>}
    </div>
  );
}
