import type { ActionCategory, HookEventEnvelope, ServerToClientMessage, WorkshopEvent } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";

const DEFAULT_WS_URL = "ws://localhost:4000/ws";
const RECONNECT_DELAY_MS = 2000;

function wsUrl(): string {
  const fromEnv = import.meta.env.VITE_COLLECTOR_WS_URL as string | undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_WS_URL;
}

function restBaseUrl(): string {
  return wsUrl().replace(/^ws/, "http").replace(/\/ws\/?$/, "");
}

interface StoredEventRow {
  sessionId: string;
  agentId: string;
  agentType: string | null;
  hookEventName: string;
  category: string;
  toolName: string | null;
  toolUseId: string | null;
  target: string | null;
  timestamp: string;
  rawJson: string;
}

function toWorkshopEvent(row: StoredEventRow): WorkshopEvent {
  let raw: HookEventEnvelope;
  try {
    raw = JSON.parse(row.rawJson) as HookEventEnvelope;
  } catch {
    raw = { session_id: row.sessionId, hook_event_name: row.hookEventName, timestamp: row.timestamp } as HookEventEnvelope;
  }
  return {
    sessionId: row.sessionId,
    agentId: row.agentId,
    agentType: row.agentType,
    hookEventName: row.hookEventName,
    category: row.category as ActionCategory,
    toolName: row.toolName,
    toolUseId: row.toolUseId,
    target: row.target,
    timestamp: row.timestamp,
    raw
  };
}

/** Backfills the event feed for a session that was already running before
 *  this client connected — the WS snapshot carries current agent state, but
 *  not the history that produced it. Best-effort: a failure here just means
 *  a thinner event feed, never blocks the live connection. */
async function backfillSession(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`${restBaseUrl()}/sessions/${encodeURIComponent(sessionId)}/events?limit=1000`);
    if (!res.ok) return;
    const rows = (await res.json()) as StoredEventRow[];
    useWorkshopStore.getState().backfillTimeline(rows.map(toWorkshopEvent));
  } catch {
    // collector unreachable for the REST call — live WS data still flows
  }
}

function handleMessage(raw: MessageEvent<string>): void {
  let message: ServerToClientMessage;
  try {
    message = JSON.parse(raw.data);
  } catch {
    return;
  }

  const store = useWorkshopStore.getState();
  switch (message.type) {
    case "snapshot":
      store.applySnapshot(message.payload);
      for (const session of message.payload.sessions) void backfillSession(session.id);
      break;
    case "event":
      store.applyEvent(message.payload, message.project, message.agent);
      break;
    case "agent_updated":
      store.applyAgentUpdate(message.sessionId, message.agentId, message.agent);
      break;
    case "session_updated":
      store.applySessionUpdate(message.sessionId, message.session);
      break;
  }
}

/** Connects to the collector's /ws endpoint and keeps the store in sync,
 *  reconnecting with a fixed backoff if the connection drops. */
export function connectLiveSource(): () => void {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const connect = () => {
    if (stopped) return;
    useWorkshopStore.getState().setStatus("connecting");
    socket = new WebSocket(wsUrl());

    socket.addEventListener("open", () => {
      useWorkshopStore.getState().setStatus("live");
    });
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", () => {
      useWorkshopStore.getState().setStatus("disconnected");
      if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    });
    socket.addEventListener("error", () => {
      socket?.close();
    });
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
