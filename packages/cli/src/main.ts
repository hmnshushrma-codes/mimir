/**
 * mimir — Live animated visualization of Claude Code sessions.
 *
 * Usage:
 *   mimir              Start the collector + web UI (default)
 *   mimir start        Same as above
 *   mimir install      Install Claude Code hooks (user scope)
 *   mimir install --project   Install hooks (project scope)
 *   mimir uninstall    Remove hooks
 *   mimir status       Show hook & collector status
 *   mimir demo         Start with demo mode (no real session needed)
 *   mimir replay-summary [--db <path>]   Per-agent display-state time breakdown
 *   mimir --help       Show this help
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { loadConfig } from "@agent-workshop/server/config";
import { openDb } from "@agent-workshop/server/db";
import { buildApp } from "@agent-workshop/server/server";
import { runReplaySummary } from "@agent-workshop/server/replay-summary";
import {
  installHooks,
  uninstallHooks,
  findOurHooks,
  shouldRemoveScript,
  type ClaudeSettings
} from "@agent-workshop/hooks/settings";
import {
  settingsPathFor,
  hookScriptPath
} from "@agent-workshop/hooks/paths";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Settings helpers ────────────────────────────────────────────────

function readSettings(file: string): ClaudeSettings {
  if (!existsSync(file)) return {};
  const raw = readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    console.error(`warning: ${file} contains invalid JSON, treating as empty`);
    return {};
  }
}

function backup(file: string): void {
  if (existsSync(file)) copyFileSync(file, `${file}.bak`);
}

function writeSettings(file: string, data: ClaudeSettings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

// ─── Hook script source ─────────────────────────────────────────────

function hookScriptSource(): string {
  // Try the built hooks package location
  for (const rel of [
    "../../hooks/dist/hook-runner.js",
    "../hooks/dist/hook-runner.js",
    "../../packages/hooks/dist/hook-runner.js"
  ]) {
    const p = resolve(__dirname, rel);
    if (existsSync(p)) return p;
  }
  throw new Error("Could not find hook-runner.js — run `pnpm build` first");
}

// ─── Display host ────────────────────────────────────────────────────

const FRIENDLY_HOST = "mimir.local";

/**
 * `mimir.local` only works if the user mapped it (e.g. `127.0.0.1 mimir.local`
 * in /etc/hosts) — `.local` names otherwise go to mDNS and fail on a fresh
 * machine. Use it only when it resolves to loopback; fall back to localhost.
 */
async function resolveDisplayHost(bindHost: string): Promise<string> {
  if (bindHost !== "0.0.0.0" && bindHost !== "127.0.0.1") return bindHost;
  try {
    const result = await Promise.race([
      lookup(FRIENDLY_HOST),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500))
    ]);
    if (result.address.startsWith("127.") || result.address === "::1") return FRIENDLY_HOST;
  } catch {
    // Not resolvable — fall through
  }
  return "localhost";
}

// ─── Commands ────────────────────────────────────────────────────────

function cmdInstall(project: boolean): void {
  const target = settingsPathFor({ project });
  const scriptDest = hookScriptPath();
  const source = hookScriptSource();

  mkdirSync(dirname(scriptDest), { recursive: true });
  copyFileSync(source, scriptDest);

  const current = readSettings(target);
  const updated = installHooks(current, scriptDest);
  backup(target);
  writeSettings(target, updated);

  console.log(`✓ Hooks installed in ${target}`);
  console.log(`  Hook script: ${scriptDest}`);
  console.log(`  Backup: ${target}.bak`);
  console.log("");
  console.log("Restart Claude Code for hooks to take effect.");
}

function cmdUninstall(project: boolean): void {
  const target = settingsPathFor({ project });
  const scriptDest = hookScriptPath();

  if (!existsSync(target)) {
    console.log(`Nothing to do — ${target} does not exist`);
    return;
  }

  const current = readSettings(target);
  const updated = uninstallHooks(current);
  backup(target);
  writeSettings(target, updated);

  // Only delete the shared script when no hooks remain in ANY scope.
  // Known limitation: project-scope hooks in OTHER projects (not this cwd)
  // cannot be detected — we'd have to scan the entire filesystem.
  const otherScope = settingsPathFor({ project: !project });
  const { remove, reason } = shouldRemoveScript(updated, otherScope, (p) => readFileSync(p, "utf-8"));

  if (remove) {
    try {
      rmSync(scriptDest);
      const dir = dirname(scriptDest);
      if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  } else {
    console.log(`  Shared hook-runner kept (${reason})`);
  }

  console.log(`✓ Hooks removed from ${target}`);
}

async function cmdStatus(): Promise<void> {
  console.log("mimir status\n");

  for (const [label, project] of [["User", false], ["Project", true]] as const) {
    const target = settingsPathFor({ project });
    const hooks = findOurHooks(readSettings(target));
    if (hooks.length === 0) {
      console.log(`  ${label} scope (${target}): not installed`);
    } else {
      console.log(`  ${label} scope (${target}): ${hooks.length} events registered`);
    }
  }

  console.log("");
  const scriptDest = hookScriptPath();
  console.log(`  Hook script: ${existsSync(scriptDest) ? "present" : "MISSING"} (${scriptDest})`);

  const base = process.env.AGENT_WORKSHOP_URL?.replace(/\/events\/?$/, "") ?? "http://127.0.0.1:4000";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${base}/sessions`, { signal: controller.signal });
    clearTimeout(timer);
    console.log(`  Collector: ${res.ok ? "reachable" : "error"} (${base})`);
  } catch {
    console.log(`  Collector: not reachable (${base})`);
  }
}

async function cmdStart(demo: boolean): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const app = buildApp({ config, db });

  const displayHost = await resolveDisplayHost(config.host);
  const url = `http://${displayHost}:${config.port}`;
  const fullUrl = demo ? `${url}/?demo=1` : url;

  await app.listen({ port: config.port, host: config.host });

  console.log(`
  ┌──────────────────────────────────────────┐
  │                                          │
  │   Mimir is running                       │
  │                                          │
  │   ${fullUrl.padEnd(38)} │
  │                                          │
  │   ${(demo ? "Demo mode — no hooks needed" : "Install hooks:  mimir install").padEnd(38)} │
  │   Stop:           Ctrl+C                 │
  │                                          │
  └──────────────────────────────────────────┘
`);

  // Try to open browser
  try {
    const { exec } = await import("node:child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} ${fullUrl}`);
  } catch {
    // Browser open failed — user can navigate manually
  }
}

function cmdReplaySummary(dbPathArg: string | undefined): void {
  const dbPath = dbPathArg ?? loadConfig().dbPath;
  if (!existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exitCode = 1;
    return;
  }
  const db = openDb(dbPath);
  runReplaySummary(db);
}

function showHelp(): void {
  console.log(`
mimir — Live animated visualization of Claude Code sessions

Usage:
  mimir                 Start the collector + web UI
  mimir start           Same as above
  mimir demo            Start with demo mode (no real session needed)
  mimir install         Install Claude Code hooks (user scope)
  mimir install --project   Install hooks for current project only
  mimir uninstall       Remove hooks
  mimir status          Show hook install & collector status
  mimir replay-summary [--db <path>]   Per-agent display-state time breakdown
  mimir --help          Show this help

Quick start:
  1. mimir install      Wire up Claude Code hooks
  2. mimir              Start the visualization server
  3. Open a Claude Code session  Watch it appear live in your browser

Requires Node >= 22.13 (for built-in SQLite module).
`);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "start";
  const project = args.includes("--project");

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  switch (command) {
    case "start":
      await cmdStart(false);
      break;
    case "demo":
      await cmdStart(true);
      break;
    case "install":
      cmdInstall(project);
      break;
    case "uninstall":
      cmdUninstall(project);
      break;
    case "status":
      await cmdStatus();
      break;
    case "replay-summary": {
      const dbFlagIndex = args.indexOf("--db");
      const dbPathArg = dbFlagIndex !== -1 ? args[dbFlagIndex + 1] : undefined;
      cmdReplaySummary(dbPathArg);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exitCode = 1;
  }
}

await main();
