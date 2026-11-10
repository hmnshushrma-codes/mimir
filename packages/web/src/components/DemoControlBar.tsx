/**
 * Control bar for the public demo — buttons to manually trigger states.
 * Only rendered when VITE_DEMO=true.
 */

import { useWorkshopStore } from "../store/useWorkshopStore.js";

interface DemoControlBarProps {
  onTrigger: (event: string) => void;
}

export function DemoControlBar({ onTrigger }: DemoControlBarProps) {
  return (
    <div className="demo-control-bar">
      <span className="demo-badge">DEMO</span>
      <button className="demo-btn" onClick={() => onTrigger("permission")}>
        🖐 Permission
      </button>
      <button className="demo-btn" onClick={() => onTrigger("spawn")}>
        ➕ Spawn Agent
      </button>
      <button className="demo-btn" onClick={() => onTrigger("error")}>
        💥 Error
      </button>
      <button className="demo-btn" onClick={() => onTrigger("finish")}>
        ✅ Finish
      </button>
    </div>
  );
}
