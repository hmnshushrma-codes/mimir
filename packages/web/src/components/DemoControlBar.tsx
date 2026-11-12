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
      <button className="demo-btn" onClick={() => onTrigger("perm_bash")} title="rm -rf dist/">
        💀 Destructive
      </button>
      <button className="demo-btn" onClick={() => onTrigger("perm_force_push")} title="git push --force">
        ⚠️ Force Push
      </button>
      <button className="demo-btn" onClick={() => onTrigger("perm_edit")} title="Write config.ts">
        📝 File Edit
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
      <button className="demo-btn" onClick={() => onTrigger("end_session")} style={{ borderColor: "var(--error)" }}>
        🛑 End Session
      </button>
    </div>
  );
}
