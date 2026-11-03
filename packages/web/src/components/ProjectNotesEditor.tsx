import { useEffect, useState } from "react";
import { fetchProjectNotes, saveProjectNotes } from "../data/notes.js";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Click-to-expand free-text notes for a single project, persisted via
 *  GET/PUT /projects/:id/notes. Stops click events from bubbling up to the
 *  dashboard card's own onClick (which navigates to the Workshop view). */
export function ProjectNotesEditor({ projectId }: { projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (!expanded || loaded) return;
    let cancelled = false;
    fetchProjectNotes(projectId)
      .then((result) => {
        if (!cancelled) setNotes(result.notes);
      })
      .catch(() => {
        // best-effort — leave the textarea empty if the fetch fails
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, loaded, projectId]);

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await saveProjectNotes(projectId, notes);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="project-notes" onClick={(e) => e.stopPropagation()}>
      <button className="project-notes-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide notes" : "Notes"}
      </button>
      {expanded && (
        <div className="project-notes-body">
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaveState("idle");
            }}
            placeholder="What's going on with this project..."
            rows={4}
          />
          <div className="project-notes-actions">
            <button onClick={handleSave} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>
            {saveState === "saved" && <span className="project-notes-status">Saved</span>}
            {saveState === "error" && <span className="project-notes-status project-notes-status-error">Failed to save</span>}
          </div>
        </div>
      )}
    </div>
  );
}
