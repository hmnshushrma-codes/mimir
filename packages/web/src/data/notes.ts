import { restBaseUrl } from "./liveSource.js";

export interface ProjectNotes {
  projectId: string;
  notes: string;
  updatedAt: string | null;
}

export async function fetchProjectNotes(projectId: string): Promise<ProjectNotes> {
  const res = await fetch(`${restBaseUrl()}/projects/${encodeURIComponent(projectId)}/notes`);
  if (!res.ok) throw new Error(`failed to fetch notes: ${res.status}`);
  return res.json() as Promise<ProjectNotes>;
}

export async function saveProjectNotes(projectId: string, notes: string): Promise<ProjectNotes> {
  const res = await fetch(`${restBaseUrl()}/projects/${encodeURIComponent(projectId)}/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes })
  });
  if (!res.ok) throw new Error(`failed to save notes: ${res.status}`);
  return res.json() as Promise<ProjectNotes>;
}
