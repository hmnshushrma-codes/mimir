import type { SerializedAgent, SerializedProject, SerializedSession } from "./serialize.js";
import type { WorkshopEvent } from "./workshop-event.js";
import type { RiskLevel } from "./redact.js";

export interface SnapshotPayload {
  projects: SerializedProject[];
  sessions: SerializedSession[];
}

/** Enriched permission request pushed to the browser for the popup. */
export interface PermissionRequestPayload {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string | null;
  projectName: string | null;
  branch: string | null;
  toolName: string | null;
  /** What is being decided: command, file path, URL, etc. */
  detail: string | null;
  /** The raw notification message from Claude Code */
  message: string | null;
  risk: RiskLevel;
  requestedAt: string;
  /** True when a PermissionRequest hook is waiting for this decision (Phase B).
   *  False when this is just a notification (Phase A info-only). */
  hookConnected?: boolean;
}

/** Fired when a permission request is resolved (approved/denied/cancelled). */
export interface PermissionResolvedPayload {
  id: string;
  sessionId: string;
  decision: string;
}

export type ServerToClientMessage =
  | { type: "snapshot"; payload: SnapshotPayload }
  | { type: "event"; payload: WorkshopEvent; project: SerializedProject; agent: SerializedAgent }
  | { type: "agent_updated"; sessionId: string; agentId: string; agent: SerializedAgent }
  | { type: "session_updated"; sessionId: string; session: SerializedSession }
  | { type: "permission_request"; payload: PermissionRequestPayload }
  | { type: "permission_resolved"; payload: PermissionResolvedPayload };
