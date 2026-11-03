import { spawn } from "node:child_process";
import type { EventRecord } from "./db.js";

const MAX_TRANSCRIPT_CHARS = 8000;
const CLAUDE_TIMEOUT_MS = 60_000;

/** Condenses a session's events into a plain-text transcript for the recap
 *  prompt: user prompts and tool calls in order, truncated to a reasonable
 *  size (long sessions would otherwise blow past a sane prompt length). */
export function buildRecapTranscript(events: EventRecord[]): string {
  const lines: string[] = [];
  for (const event of events) {
    if (event.hookEventName === "UserPromptSubmit" && event.target) {
      lines.push(`User: ${event.target}`);
    } else if (event.hookEventName === "PreToolUse" && event.toolName) {
      lines.push(`Tool ${event.toolName}: ${event.target ?? ""}`.trimEnd());
    } else if (event.hookEventName === "PostToolUseFailure" && event.toolName) {
      lines.push(`Tool ${event.toolName} FAILED`);
    }
  }
  const transcript = lines.join("\n");
  return transcript.length > MAX_TRANSCRIPT_CHARS
    ? `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n[...truncated]`
    : transcript;
}

/** Spawns the user's local `claude` CLI in headless print mode to generate a
 *  recap. Uses spawn + stdin.end() (not execFile's default) — otherwise
 *  claude waits ~3s to detect there's no piped input before proceeding. */
export function generateRecap(transcript: string): Promise<string> {
  const prompt = `Summarize what this Claude Code session accomplished as 2-5 short bullet points. Each bullet starts with "- " on its own line, is one concise sentence, and is specific about what changed — not a blow-by-blow of each tool call. No heading, no preamble, no closing remarks — output only the bullet list.\n\n${transcript}`;

  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      // Prevents this headless recap call from reporting itself back to
      // Mimir as a phantom session via the user's installed hooks.
      env: { ...process.env, AGENT_WORKSHOP_SKIP_HOOKS: "1" }
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude -p timed out"));
    }, CLAUDE_TIMEOUT_MS);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.end();
  });
}
