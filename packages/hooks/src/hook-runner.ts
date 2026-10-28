// Invoked directly by Claude Code as a "command" hook (see the installer in
// cli.ts). Contract, non-negotiable per the project brief:
//   - never slow down or break Claude Code
//   - timeout of 1 second or less
//   - always exit 0
//   - write nothing to stdout or stderr
//   - if the collector server is down, fail silently
//
// Deliberately has zero import/export statements: this file is copied
// verbatim to a stable location outside this package (see paths.ts) and must
// run correctly whether Node treats it as CommonJS or ESM there.

const COLLECTOR_URL = process.env.AGENT_WORKSHOP_URL || "http://127.0.0.1:4000/events";
const FETCH_TIMEOUT_MS = 700;
const WATCHDOG_TIMEOUT_MS = 900;

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk: string) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", () => resolve(data));
    } catch {
      resolve(data);
    }
  });
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  payload.timestamp = new Date().toISOString();

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    await fetch(COLLECTOR_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch {
    // Collector down, network error, or aborted — fail silently by design.
  } finally {
    clearTimeout(abortTimer);
  }
}

let exited = false;
function exitNow(): void {
  if (exited) return;
  exited = true;
  process.exit(0);
}

const watchdog = setTimeout(exitNow, WATCHDOG_TIMEOUT_MS);

main()
  .catch(() => {})
  .finally(() => {
    clearTimeout(watchdog);
    exitNow();
  });
