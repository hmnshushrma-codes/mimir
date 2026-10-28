export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
  previewsEnabled: boolean;
  previewMaxLen: number;
  idleMs: number;
  staleMs: number;
  sweepIntervalMs: number;
  departAfterMs: number;
  sessionIdleAfterMs: number;
  sessionEndedAfterMs: number;
  longToolCallMs: number;
  detectScanIntervalMs: number;
  detectWindowMs: number;
}

function int(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value !== "false" && value !== "0";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: int(env.AGENT_WORKSHOP_PORT, 4000),
    host: env.AGENT_WORKSHOP_HOST ?? "127.0.0.1",
    dbPath: env.AGENT_WORKSHOP_DB_PATH ?? "./agent-workshop.sqlite",
    previewsEnabled: bool(env.AGENT_WORKSHOP_PREVIEWS, true),
    previewMaxLen: int(env.AGENT_WORKSHOP_PREVIEW_MAX_LEN, 500),
    idleMs: int(env.AGENT_WORKSHOP_IDLE_MS, 30_000),
    staleMs: int(env.AGENT_WORKSHOP_STALE_MS, 5 * 60_000),
    sweepIntervalMs: int(env.AGENT_WORKSHOP_SWEEP_INTERVAL_MS, 5_000),
    departAfterMs: int(env.AGENT_WORKSHOP_DEPART_AFTER_MS, 4_000),
    sessionIdleAfterMs: int(env.AGENT_WORKSHOP_SESSION_IDLE_MS, 2 * 60_000),
    sessionEndedAfterMs: int(env.AGENT_WORKSHOP_SESSION_ENDED_AFTER_MS, 15 * 60_000),
    longToolCallMs: int(env.AGENT_WORKSHOP_LONG_TOOL_CALL_MS, 15_000),
    detectScanIntervalMs: int(env.AGENT_WORKSHOP_DETECT_SCAN_INTERVAL_MS, 30_000),
    detectWindowMs: int(env.AGENT_WORKSHOP_DETECT_WINDOW_MS, 10 * 60_000)
  };
}
