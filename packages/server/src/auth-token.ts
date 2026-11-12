/**
 * Auth token for remote permission approval.
 * Generated once at install, stored at ~/.claude/agent-workshop/mimir-token
 * with 0600 permissions. The hook sends it in X-Mimir-Token header;
 * the browser gets it from the same-origin page.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const TOKEN_PATH = join(homedir(), ".claude", "agent-workshop", "mimir-token");
const TOKEN_BYTES = 32;

/** Get or create the auth token. Creates parent dirs if needed. */
export function getOrCreateToken(): string {
  if (existsSync(TOKEN_PATH)) {
    try {
      const token = readFileSync(TOKEN_PATH, "utf-8").trim();
      if (token.length >= 32) return token;
    } catch {
      // Fall through to regenerate
    }
  }

  const dir = dirname(TOKEN_PATH);
  mkdirSync(dir, { recursive: true });

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  writeFileSync(TOKEN_PATH, token, { mode: 0o600 });

  // Ensure permissions are strict even if umask was permissive
  try { chmodSync(TOKEN_PATH, 0o600); } catch { /* Windows doesn't support chmod */ }

  return token;
}

/** Read the existing token. Returns null if not found. */
export function readToken(): string | null {
  try {
    const token = readFileSync(TOKEN_PATH, "utf-8").trim();
    return token.length >= 32 ? token : null;
  } catch {
    return null;
  }
}

/** Validate a token from a request header. Constant-time comparison. */
export function validateToken(provided: string | undefined | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  // Constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

export function tokenPath(): string {
  return TOKEN_PATH;
}
