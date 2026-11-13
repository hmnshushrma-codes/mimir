/**
 * Privacy redaction — deterministic placeholders for project names, paths,
 * branches, commands, prompts. Stable per session so the UI doesn't flicker.
 *
 * Used when Privacy toggle is ON: replaces real data everywhere including
 * tooltips, document title, exported screenshots.
 */

const STORAGE_KEY = "mimir:privacy:v1";

// ── Deterministic placeholder maps ──────────────────────────

const PROJECT_NAMES = ["project-alpha", "project-beta", "project-gamma", "project-delta", "project-epsilon"];
const BRANCH_NAMES = ["branch-1", "branch-2", "feature-x", "develop", "staging"];
const AGENT_NAMES = ["agent-a", "agent-b", "agent-c", "worker-1", "worker-2"];
const FILE_PATHS = ["src/module.ts", "src/index.ts", "lib/utils.ts", "app/main.ts", "config/settings.ts"];
const COMMANDS = ["npm run build", "pnpm test", "node script.js", "tsc --noEmit", "eslint ."];
const PROMPTS = [
  "Fix the authentication flow",
  "Add unit tests for the API",
  "Refactor the database layer",
  "Update the configuration",
  "Implement the search feature",
];

// Simple stable hash → index
function stableIndex(s: string, pool: string[]): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % pool.length;
}

// ── Public API ──────────────────────────────────────────────

export function loadPrivacyEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

export function savePrivacyEnabled(v: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* noop */ }
}

export function redactProject(name: string): string {
  return PROJECT_NAMES[stableIndex(name, PROJECT_NAMES)];
}

export function redactBranch(branch: string): string {
  return BRANCH_NAMES[stableIndex(branch, BRANCH_NAMES)];
}

export function redactAgent(name: string): string {
  return AGENT_NAMES[stableIndex(name, AGENT_NAMES)];
}

export function redactPath(path: string): string {
  return FILE_PATHS[stableIndex(path, FILE_PATHS)];
}

export function redactCommand(cmd: string): string {
  return COMMANDS[stableIndex(cmd, COMMANDS)];
}

export function redactPrompt(prompt: string): string {
  return PROMPTS[stableIndex(prompt, PROMPTS)];
}

/** Redact any text — picks a stable generic replacement based on the content. */
export function redactText(text: string, type: "project" | "branch" | "path" | "command" | "prompt" | "agent" = "project"): string {
  switch (type) {
    case "project": return redactProject(text);
    case "branch": return redactBranch(text);
    case "path": return redactPath(text);
    case "command": return redactCommand(text);
    case "prompt": return redactPrompt(text);
    case "agent": return redactAgent(text);
    default: return text;
  }
}

/** Generic activity ticker verbs for privacy mode */
export const GENERIC_TICKER_ITEMS = [
  "Reading files",
  "Writing code",
  "Running tests",
  "Searching codebase",
  "Editing module",
  "Building project",
];
