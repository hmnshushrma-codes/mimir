export interface HookHandler {
  type: string;
  command?: string;
  args?: string[];
  timeout?: number;
  [key: string]: unknown;
}

export interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
  [key: string]: unknown;
}

export type HooksSection = Record<string, HookGroup[]>;

export interface ClaudeSettings {
  hooks?: HooksSection;
  [key: string]: unknown;
}

/**
 * The v1-scope events from docs/hook-events.md: the brief's explicit list
 * (session start/end, user prompt submit, pre/post tool use, subagent
 * start/stop, notification, stop) plus PostToolUseFailure — without it, the
 * error/smoke-puff animation could never fire from a real session, only from
 * demo data, which defeats half the acceptance criteria.
 */
export const MANAGED_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
  "Notification",
  "Stop"
] as const;

// Matched by a stable relative suffix rather than exact path equality, so a
// re-install still finds and replaces an old entry even if the absolute
// install path resolution ever changes between versions (e.g. a different
// home-directory computation) — nothing should be able to orphan a stale
// copy of our own hook forever.
const INSTALL_PATH_SUFFIX = ".claude/agent-workshop/hook-runner.mjs";

function isOurHandler(handler: HookHandler): boolean {
  if (handler.type !== "command") return false;
  const cmd = handler.command ?? "";
  // Match both old format (command: "node", args: [path]) and new (command: "node path")
  if (handler.command === "node" && handler.args?.[0]) {
    return handler.args[0].replace(/\\/g, "/").endsWith(INSTALL_PATH_SUFFIX);
  }
  return cmd.replace(/\\/g, "/").includes(INSTALL_PATH_SUFFIX);
}

function ourHandler(hookScriptPath: string): HookHandler {
  return { type: "command", command: `node ${hookScriptPath}`, timeout: 1 };
}

export interface InstalledHookEntry {
  event: string;
  scriptPath: string;
  timeout: number | undefined;
}

/** Finds our own hook entries across every event in a settings file —
 *  used by `agent-workshop status` to report exactly what's registered. */
export function findOurHooks(settings: ClaudeSettings): InstalledHookEntry[] {
  const found: InstalledHookEntry[] = [];
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups) {
      for (const handler of group.hooks) {
        if (isOurHandler(handler)) {
          const scriptPath = handler.args?.[0] ?? handler.command?.split(" ").slice(1).join(" ") ?? "";
          found.push({ event, scriptPath, timeout: handler.timeout });
        }
      }
    }
  }
  return found;
}

/**
 * Adds (or idempotently replaces) our hook entry on every managed event,
 * without touching any other tool's hooks on those same events. Never
 * mutates the input.
 */
export function installHooks(settings: ClaudeSettings, hookScriptPath: string): ClaudeSettings {
  const nextHooks: HooksSection = { ...(settings.hooks ?? {}) };

  for (const event of MANAGED_EVENTS) {
    const existingGroups = nextHooks[event] ?? [];
    const withoutOurs = existingGroups
      .map((group) => ({ ...group, hooks: group.hooks.filter((h) => !isOurHandler(h)) }))
      .filter((group) => group.hooks.length > 0);
    nextHooks[event] = [...withoutOurs, { matcher: "", hooks: [ourHandler(hookScriptPath)] }];
  }

  return { ...settings, hooks: nextHooks };
}

/**
 * Removes exactly our hook entries, deleting now-empty groups and, if no
 * hooks remain at all, the `hooks` key itself — so the file comes back to
 * exactly what it would have looked like had we never installed, apart from
 * whatever else changed in the meantime.
 */
export function uninstallHooks(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks) return { ...settings };

  const nextHooks: HooksSection = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    const filtered = groups
      .map((group) => ({ ...group, hooks: group.hooks.filter((h) => !isOurHandler(h)) }))
      .filter((group) => group.hooks.length > 0);
    if (filtered.length > 0) nextHooks[event] = filtered;
  }

  const next: ClaudeSettings = { ...settings };
  if (Object.keys(nextHooks).length > 0) {
    next.hooks = nextHooks;
  } else {
    delete next.hooks;
  }
  return next;
}
