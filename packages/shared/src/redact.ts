/**
 * Redacts obvious secrets from user-facing text before storing or displaying.
 *
 * Targets: API keys, bearer tokens, passwords, AWS keys, private keys,
 * connection strings with credentials, and env-style secrets.
 * Conservative: only redacts patterns that are clearly secrets.
 */

// Patterns that match common secret formats
const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys: sk-..., xoxb-..., ghp_..., glpat-..., AKIA..., etc.
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})/g, replacement: "sk-***REDACTED***" },
  { pattern: /\b(xox[bpsar]-[a-zA-Z0-9-]{10,})/g, replacement: "xox*-***REDACTED***" },
  { pattern: /\b(ghp_[a-zA-Z0-9]{30,})/g, replacement: "ghp_***REDACTED***" },
  { pattern: /\b(gho_[a-zA-Z0-9]{30,})/g, replacement: "gho_***REDACTED***" },
  { pattern: /\b(glpat-[a-zA-Z0-9_-]{20,})/g, replacement: "glpat-***REDACTED***" },
  { pattern: /\b(AKIA[A-Z0-9]{12,})/g, replacement: "AKIA***REDACTED***" },

  // Bearer tokens
  { pattern: /(Bearer\s+)[a-zA-Z0-9._\-]{20,}/gi, replacement: "$1***REDACTED***" },

  // Generic long hex/base64 tokens (40+ chars of hex or 30+ chars of base64-like)
  { pattern: /\b([a-f0-9]{40,})\b/g, replacement: "***REDACTED_HEX***" },

  // password= or passwd= or secret= in URLs or env vars
  { pattern: /((?:password|passwd|secret|token|api_key|apikey|access_key|private_key)\s*[=:]\s*)[^\s,;'"}{)]+/gi, replacement: "$1***REDACTED***" },

  // Connection strings with passwords: ://user:pass@host
  { pattern: /(:\/\/[^:]+:)[^@]+(@)/g, replacement: "$1***REDACTED***$2" },

  // PEM private key blocks
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g, replacement: "***REDACTED_PRIVATE_KEY***" },

  // .env style: SOME_SECRET=value (only when key suggests a secret)
  { pattern: /\b([A-Z_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z_]*\s*=\s*)[^\s]+/g, replacement: "$1***REDACTED***" },
];

/**
 * Redact obvious secrets from text. Returns cleaned text.
 * Only redacts high-confidence patterns — not general short strings.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexps
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Classify risk level of a command or tool operation.
 * Returns null if no special risk detected.
 */
export type RiskLevel = "destructive" | "external" | "elevated" | null;

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf?\b/,
  /\bgit\s+push\s+--force\b/,
  /\bgit\s+push\s+-f\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-f/,
  /\bdrop\s+table\b/i,
  /\bdrop\s+database\b/i,
  /\btruncate\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bcurl\b.*\|\s*sh\b/,
  /\bcurl\b.*\|\s*bash\b/,
  /\bwget\b.*\|\s*sh\b/,
  /\bchmod\s+777\b/,
  /\bsudo\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
];

const EXTERNAL_PATTERNS = [
  /\bgit\s+push\b/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bnpm\s+publish\b/,
  /\bdocker\s+push\b/,
  /\bscp\b/,
  /\brsync\b.*:/,
  /\bssh\b/,
];

export function classifyRisk(command: string): RiskLevel {
  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(command)) return "destructive";
  }
  for (const p of EXTERNAL_PATTERNS) {
    if (p.test(command)) return "external";
  }
  return null;
}
