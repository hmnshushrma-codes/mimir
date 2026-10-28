import type { SerializedAgent, SerializedProject, SerializedSession } from "./serialize.js";
import type { WorkshopEvent } from "./workshop-event.js";

export interface SnapshotPayload {
  projects: SerializedProject[];
  sessions: SerializedSession[];
}

export type ServerToClientMessage =
  | { type: "snapshot"; payload: SnapshotPayload }
  | { type: "event"; payload: WorkshopEvent; project: SerializedProject; agent: SerializedAgent }
  | { type: "agent_updated"; sessionId: string; agentId: string; agent: SerializedAgent }
  | { type: "session_updated"; sessionId: string; session: SerializedSession };
