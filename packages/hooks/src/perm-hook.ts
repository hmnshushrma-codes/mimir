// PermissionRequest hook for remote approval from the Mimir dashboard.
//
// Contract (same as hook-runner.ts):
//   - never slow down or break Claude Code beyond the configured timeout
//   - always exit 0
//   - if the collector server is down, fail silently (terminal takes over)
//   - NEVER default to allow — only explicit decisions
//
// Flow:
//   1. Read stdin (PermissionRequest payload from Claude Code)
//   2. POST to Mimir server with payload + auth token
//   3. Long-poll the server for a decision (allow/deny/terminal)
//   4. Monitor stdin for disconnect (terminal answered first)
//   5. On decision: output the appropriate JSON
//   6. On timeout/error: exit silent (terminal takes over)
//
// NOTE: This file is saved as .mjs (ESM). Do NOT use require() — it's
// undefined in ESM. Use dynamic import() for node built-ins.

const COLLECTOR_URL = process.env.AGENT_WORKSHOP_URL || "http://127.0.0.1:4000";
const TOKEN_PATH = process.env.MIMIR_TOKEN_PATH || "";
const CONNECT_TIMEOUT_MS = 300;
const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 120_000; // 2 minutes

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk: string) => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", () => resolve(data));
    } catch {
      resolve(data);
    }
  });
}

async function readTokenFile(): Promise<string> {
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const tokenPath = TOKEN_PATH || join(homedir(), ".claude", "agent-workshop", "mimir-token");
    return readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  if (process.env.AGENT_WORKSHOP_SKIP_HOOKS === "1") return;

  const raw = await readStdin();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return; // Can't parse — exit silent
  }

  // Only handle PermissionRequest events
  if (payload.hook_event_name !== "PermissionRequest") return;

  const token = await readTokenFile();
  if (!token) return; // No token — can't authenticate, exit silent

  // POST the request to the server
  let requestId: string;
  try {
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const res = await fetch(`${COLLECTOR_URL}/permissions/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mimir-token": token,
      },
      body: JSON.stringify({
        sessionId: payload.session_id,
        agentId: payload.agent_id ?? "main",
        agentName: payload.agent_type ?? null,
        toolName: payload.tool_name,
        toolInput: payload.tool_input,
        cwd: payload.cwd ?? null,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(connectTimer);

    if (!res.ok) return; // Server error — exit silent

    const body = await res.json() as { id?: string };
    requestId = body.id ?? "";
    if (!requestId) return;
  } catch {
    return; // Server unreachable — exit silent
  }

  // Poll for decision
  const deadline = Date.now() + MAX_WAIT_MS;
  let stdinDisconnected = false;

  // Monitor stdin disconnect (terminal answered first)
  process.stdin.on("close", () => { stdinDisconnected = true; });
  process.stdin.resume(); // Keep reading so we detect close

  while (Date.now() < deadline) {
    if (stdinDisconnected) return; // Terminal answered — exit silent

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), POLL_INTERVAL_MS + 200);
      const res = await fetch(`${COLLECTOR_URL}/permissions/poll/${encodeURIComponent(requestId)}`, {
        headers: { "x-mimir-token": token },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // 404 = expired/decided, other = error
        if (res.status === 404) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      const body = await res.json() as { decision?: string; reason?: string };
      if (!body.decision || body.decision === "pending") {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      // Got a decision from the dashboard
      if (body.decision === "allow") {
        const output = JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: { behavior: "allow" },
          },
        });
        process.stdout.write(output);
        return;
      }

      if (body.decision === "deny") {
        const output = JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: { behavior: "deny" },
          },
          reason: body.reason || "Denied from Mimir dashboard",
        });
        process.stdout.write(output);
        return;
      }

      // "terminal" or unknown — exit silent, let terminal handle it
      return;
    } catch {
      // Network error during poll — retry
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  // Timeout — exit silent, terminal takes over
}

let exited = false;
function exitNow(): void {
  if (exited) return;
  exited = true;
  process.exit(0);
}

// Watchdog: slightly over MAX_WAIT_MS to allow clean exit
const watchdog = setTimeout(exitNow, MAX_WAIT_MS + 5000);

main()
  .catch(() => {})
  .finally(() => {
    clearTimeout(watchdog);
    exitNow();
  });
