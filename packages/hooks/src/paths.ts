import os from "node:os";
import path from "node:path";

export function userSettingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

export function projectSettingsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, ".claude", "settings.json");
}

export function settingsPathFor(options: { project: boolean; cwd?: string }): string {
  return options.project ? projectSettingsPath(options.cwd) : userSettingsPath();
}

/** Stable, machine-local destination for the installed hook script —
 *  independent of wherever `npx agent-workshop` happened to run from. */
export function hookScriptPath(): string {
  return path.join(os.homedir(), ".claude", "agent-workshop", "hook-runner.mjs");
}
