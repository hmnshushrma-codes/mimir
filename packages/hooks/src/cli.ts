#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findOurHooks, installHooks, uninstallHooks, type ClaudeSettings } from "./settings.js";
import { settingsPathFor, hookScriptPath } from "./paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSettings(file: string): ClaudeSettings {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as ClaudeSettings;
}

function backup(file: string): void {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
  }
}

function writeSettings(file: string, data: ClaudeSettings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function install(project: boolean): void {
  const target = settingsPathFor({ project });
  const scriptDest = hookScriptPath();

  fs.mkdirSync(path.dirname(scriptDest), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "hook-runner.js"), scriptDest);

  const current = readSettings(target);
  const updated = installHooks(current, scriptDest);
  backup(target);
  writeSettings(target, updated);

  console.log(`agent-workshop: installed hooks in ${target}`);
  console.log(`agent-workshop: hook script written to ${scriptDest}`);
  console.log(`agent-workshop: backup saved to ${target}.bak`);
}

function uninstall(project: boolean): void {
  const target = settingsPathFor({ project });
  const scriptDest = hookScriptPath();

  if (!fs.existsSync(target)) {
    console.log(`agent-workshop: ${target} does not exist, nothing to do`);
    return;
  }

  const current = readSettings(target);
  const updated = uninstallHooks(current);
  backup(target);
  writeSettings(target, updated);

  if (fs.existsSync(scriptDest)) {
    fs.rmSync(scriptDest);
    const scriptDir = path.dirname(scriptDest);
    if (fs.existsSync(scriptDir) && fs.readdirSync(scriptDir).length === 0) fs.rmdirSync(scriptDir);
  }

  console.log(`agent-workshop: removed hooks from ${target}`);
  console.log(`agent-workshop: backup saved to ${target}.bak`);
}

function collectorBaseUrl(): string {
  const url = process.env.AGENT_WORKSHOP_URL ?? "http://127.0.0.1:4000/events";
  return url.replace(/\/events\/?$/, "");
}

async function checkCollector(): Promise<{ reachable: boolean; base: string }> {
  const base = collectorBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${base}/sessions`, { signal: controller.signal });
    return { reachable: res.ok, base };
  } catch {
    return { reachable: false, base };
  } finally {
    clearTimeout(timer);
  }
}

function describeScope(label: string, target: string): void {
  const hooks = findOurHooks(readSettings(target));
  if (hooks.length === 0) {
    console.log(`${label} (${target}): not installed`);
    return;
  }
  const events = hooks
    .map((h) => h.event)
    .sort()
    .join(", ");
  console.log(`${label} (${target}): installed — ${hooks.length} event(s) registered`);
  console.log(`  events: ${events}`);
  console.log(`  script: ${hooks[0].scriptPath}`);
}

async function status(): Promise<void> {
  console.log("agent-workshop status\n");

  describeScope("User scope", settingsPathFor({ project: false }));
  describeScope("Project scope", settingsPathFor({ project: true }));

  console.log("");
  const scriptDest = hookScriptPath();
  console.log(`Hook script: ${scriptDest} (${fs.existsSync(scriptDest) ? "present" : "missing"})`);

  console.log("");
  const { reachable, base } = await checkCollector();
  console.log(`Collector at ${base}: ${reachable ? "reachable" : "NOT reachable"}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const project = args.includes("--project");

  switch (command) {
    case "install":
      install(project);
      break;
    case "uninstall":
      uninstall(project);
      break;
    case "status":
      await status();
      break;
    default:
      console.log("Usage: agent-workshop <install|uninstall|status> [--project]");
      process.exitCode = 1;
  }
}

await main();
