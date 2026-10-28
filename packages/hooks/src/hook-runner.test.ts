import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_RUNNER = path.join(__dirname, "hook-runner.ts");
const TSX_CLI = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");

function runHook(stdin: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; exitCode: number | null; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(process.execPath, [TSX_CLI, HOOK_RUNNER], { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode, durationMs: Date.now() - start });
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

describe("hook-runner", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server!.close(resolve));
      server = null;
    }
  });

  it("POSTs the stdin payload with an injected timestamp, writes nothing, and exits 0", async () => {
    let received: { body: string; headers: Record<string, string | string[] | undefined> } | null = null;

    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = { body, headers: req.headers };
        res.writeHead(204);
        res.end();
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const port = (server!.address() as { port: number }).port;

    const payload = { session_id: "s1", hook_event_name: "SessionStart", source: "startup" };
    const result = await runHook(JSON.stringify(payload), { AGENT_WORKSHOP_URL: `http://127.0.0.1:${port}/events` });

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);

    expect(received).not.toBeNull();
    const parsed = JSON.parse(received!.body);
    expect(parsed.session_id).toBe("s1");
    expect(parsed.hook_event_name).toBe("SessionStart");
    expect(typeof parsed.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(parsed.timestamp))).toBe(false);
  });

  it("fails silently and still exits 0 when the collector is unreachable", async () => {
    const result = await runHook(JSON.stringify({ session_id: "s1", hook_event_name: "Stop" }), {
      AGENT_WORKSHOP_URL: "http://127.0.0.1:1/events"
    });

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeLessThan(1500);
  });

  it("fails silently and still exits 0 on invalid JSON from stdin", async () => {
    const result = await runHook("not json", { AGENT_WORKSHOP_URL: "http://127.0.0.1:1/events" });

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });
});
