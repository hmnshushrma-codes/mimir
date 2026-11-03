import { restBaseUrl } from "./liveSource.js";

export interface SessionRecap {
  sessionId: string;
  recap: string;
  model: string | null;
  generatedAt: string;
}

export async function fetchSessionRecap(sessionId: string): Promise<SessionRecap | null> {
  const res = await fetch(`${restBaseUrl()}/sessions/${encodeURIComponent(sessionId)}/recap`);
  if (!res.ok) throw new Error(`failed to fetch recap: ${res.status}`);
  return res.json() as Promise<SessionRecap | null>;
}

export async function generateSessionRecap(sessionId: string): Promise<SessionRecap> {
  const res = await fetch(`${restBaseUrl()}/sessions/${encodeURIComponent(sessionId)}/recap`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `failed to generate recap: ${res.status}`);
  }
  return res.json() as Promise<SessionRecap>;
}
