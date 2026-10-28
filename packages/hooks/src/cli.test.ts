import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Deliberately the compiled artifact, not the .ts source via tsx: install's
// logic copies a sibling dist/hook-runner.js next to wherever this CLI is
// running from, so the test has to run the real post-build layout (see the
// package's "pretest" script) to exercise that path faithfully.
const CLI = path.join(__dirname, "..", "dist", "cli.js");

function runCli(args: string[], env: Record<string, string>): Promise<{ stdout: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, ...env } });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ stdout, exitCode }));
  });
}

describe("agent-workshop CLI", () => {
  let home: string;

  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true });
  });

  function freshHome(): Record<string, string> {
    home = mkdtempSync(path.join(os.tmpdir(), "agent-workshop-cli-"));
    return { HOME: home, USERPROFILE: home };
  }

  it("install writes hooks to the user settings file and a hook script", async () => {
    const env = freshHome();
    const result = await runCli(["install"], env);
    expect(result.exitCode).toBe(0);

    const settingsPath = path.join(home, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks.SessionStart).toBeDefined();

    const scriptPath = path.join(home, ".claude", "agent-workshop", "hook-runner.mjs");
    expect(existsSync(scriptPath)).toBe(true);
  }, 20000);

  it("status reports installed after install, and reachable/unreachable collector correctly", async () => {
    const env = freshHome();
    await runCli(["install"], env);

    const notReachable = await runCli(["status"], { ...env, AGENT_WORKSHOP_URL: "http://127.0.0.1:1/events" });
    expect(notReachable.stdout).toContain("installed");
    expect(notReachable.stdout).toContain("NOT reachable");

    const server: Server = createServer((_req, res) => res.writeHead(200).end("[]"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    const reachable = await runCli(["status"], { ...env, AGENT_WORKSHOP_URL: `http://127.0.0.1:${port}/events` });
    expect(reachable.stdout).toContain("installed");
    expect(reachable.stdout).toContain("Collector at");
    expect(reachable.stdout).not.toContain("NOT reachable");

    await new Promise((resolve) => server.close(resolve));
  }, 20000);

  it("status reports not installed on a clean home", async () => {
    const env = freshHome();
    const result = await runCli(["status"], { ...env, AGENT_WORKSHOP_URL: "http://127.0.0.1:1/events" });
    expect(result.stdout).toContain("not installed");
  }, 20000);

  it("uninstall removes hooks and the script, status then reports not installed", async () => {
    const env = freshHome();
    await runCli(["install"], env);
    const uninstallResult = await runCli(["uninstall"], env);
    expect(uninstallResult.exitCode).toBe(0);

    const scriptPath = path.join(home, ".claude", "agent-workshop", "hook-runner.mjs");
    expect(existsSync(scriptPath)).toBe(false);

    const status = await runCli(["status"], { ...env, AGENT_WORKSHOP_URL: "http://127.0.0.1:1/events" });
    expect(status.stdout).toContain("not installed");
  }, 20000);
});
