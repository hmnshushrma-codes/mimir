import { useState } from "react";
import type { SerializedSession } from "@agent-workshop/shared";

export function FinishedSessionsShelf({
  sessions,
  projectNameFor
}: {
  sessions: SerializedSession[];
  projectNameFor: (projectId: string) => string;
}) {
  const [open, setOpen] = useState(false);
  if (sessions.length === 0) return null;

  return (
    <div className="finished-today-shelf">
      <button className="tab-button" onClick={() => setOpen((o) => !o)}>
        Finished today ({sessions.length}) {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="finished-today-list">
          {sessions.map((s) => (
            <div key={s.id} className="finished-today-item muted">
              {projectNameFor(s.projectId)} · {s.id.slice(0, 8)}
              {s.branch ? ` · ${s.branch}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
