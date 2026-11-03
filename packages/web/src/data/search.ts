import { restBaseUrl } from "./liveSource.js";

export interface SearchResult {
  id: number;
  sessionId: string;
  projectId: string;
  agentId: string;
  hookEventName: string;
  toolName: string | null;
  target: string | null;
  timestamp: string;
}

export async function searchEvents(q: string, projectId?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q });
  if (projectId) params.set("projectId", projectId);
  const res = await fetch(`${restBaseUrl()}/search?${params.toString()}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json() as Promise<SearchResult[]>;
}
