/**
 * Permission request manager for Phase B remote approval.
 *
 * Manages the lifecycle of pending permission requests:
 *   hook submits → server stores → browser displays → user decides → hook receives
 *
 * Key invariants:
 * - Each request has a unique ID (session_id + input hash + timestamp)
 * - Decisions are single-use (can't replay)
 * - Stale requests expire after configurable timeout
 * - Deduplication by session + tool_name + input hash within a time window
 */

import { createHash } from "node:crypto";
import { redactSecrets, classifyRisk, type RiskLevel } from "@agent-workshop/shared";

export interface PendingPermission {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string | null;
  projectName: string | null;
  branch: string | null;
  toolName: string;
  toolInput: unknown;
  /** Redacted display detail (command, file path, URL) */
  detail: string | null;
  /** Raw detail for execution (NOT sent to browser) */
  rawDetail: string | null;
  message: string | null;
  cwd: string | null;
  risk: RiskLevel;
  requestedAt: string;
  /** Resolves the hook's wait */
  resolve: (decision: PermissionDecision) => void;
  expiresAt: number;
}

export interface PermissionDecision {
  behavior: "allow" | "deny" | "terminal";
  reason?: string;
  source: "dashboard" | "terminal" | "timeout";
}

export interface AuditEntry {
  id: string;
  sessionId: string;
  projectName: string | null;
  toolName: string;
  detail: string | null;
  decision: string;
  source: string;
  decidedAt: string;
}

const DEDUP_WINDOW_MS = 2000; // 2 seconds
const DEFAULT_EXPIRE_MS = 120_000; // 2 minutes

export class PermissionManager {
  private pending = new Map<string, PendingPermission>();
  private auditLog: AuditEntry[] = [];
  private expireMs: number;

  constructor(expireMs = DEFAULT_EXPIRE_MS) {
    this.expireMs = expireMs;
  }

  /** Generate a unique request ID from session + tool + input + time */
  static requestId(sessionId: string, toolName: string, toolInput: unknown): string {
    const hash = createHash("sha256")
      .update(sessionId)
      .update(toolName)
      .update(JSON.stringify(toolInput ?? ""))
      .update(String(Date.now()))
      .digest("hex")
      .slice(0, 16);
    return `perm-${sessionId.slice(0, 8)}-${hash}`;
  }

  /** Check for duplicate — same session + tool + similar input within time window */
  isDuplicate(sessionId: string, toolName: string, toolInput: unknown): string | null {
    const inputStr = JSON.stringify(toolInput ?? "");
    const now = Date.now();
    for (const [id, p] of this.pending) {
      if (
        p.sessionId === sessionId &&
        p.toolName === toolName &&
        JSON.stringify(p.toolInput ?? "") === inputStr &&
        now - Date.parse(p.requestedAt) < DEDUP_WINDOW_MS
      ) {
        return id;
      }
    }
    return null;
  }

  /** Extract display detail from tool input */
  static extractDetail(toolName: string, toolInput: unknown): { detail: string | null; rawDetail: string | null } {
    const input = toolInput as Record<string, unknown> | undefined;
    if (!input) return { detail: null, rawDetail: null };

    let raw: string | null = null;
    if (toolName === "Bash" && typeof input.command === "string") {
      raw = input.command;
    } else if ((toolName === "Edit" || toolName === "Write") && typeof input.file_path === "string") {
      raw = input.file_path;
    } else if (toolName === "WebFetch" && typeof input.url === "string") {
      raw = input.url;
    } else if (typeof input.command === "string") {
      raw = input.command;
    } else if (typeof input.file_path === "string") {
      raw = input.file_path;
    } else if (typeof input.url === "string") {
      raw = input.url;
    } else if (typeof input.description === "string") {
      raw = input.description;
    }

    return { detail: raw ? redactSecrets(raw) : null, rawDetail: raw };
  }

  /** Register a new pending request. Returns the request ID and a promise that resolves with the decision. */
  register(params: {
    sessionId: string;
    agentId: string;
    agentName: string | null;
    projectName: string | null;
    branch: string | null;
    toolName: string;
    toolInput: unknown;
    cwd: string | null;
  }): { id: string; existing: boolean; promise: Promise<PermissionDecision> } {
    // Check for duplicate
    const dupId = this.isDuplicate(params.sessionId, params.toolName, params.toolInput);
    if (dupId) {
      const existing = this.pending.get(dupId)!;
      return {
        id: dupId,
        existing: true,
        promise: new Promise((resolve) => {
          // Chain onto existing resolve
          const origResolve = existing.resolve;
          existing.resolve = (d) => { origResolve(d); resolve(d); };
        }),
      };
    }

    const id = PermissionManager.requestId(params.sessionId, params.toolName, params.toolInput);
    const { detail, rawDetail } = PermissionManager.extractDetail(params.toolName, params.toolInput);
    const risk = rawDetail ? classifyRisk(rawDetail) : null;
    const now = new Date().toISOString();

    let resolveDecision: (d: PermissionDecision) => void;
    const promise = new Promise<PermissionDecision>((r) => { resolveDecision = r; });

    const pending: PendingPermission = {
      id,
      sessionId: params.sessionId,
      agentId: params.agentId,
      agentName: params.agentName,
      projectName: params.projectName,
      branch: params.branch,
      toolName: params.toolName,
      toolInput: params.toolInput,
      detail,
      rawDetail,
      message: null,
      cwd: params.cwd,
      risk,
      requestedAt: now,
      resolve: resolveDecision!,
      expiresAt: Date.now() + this.expireMs,
    };

    this.pending.set(id, pending);
    return { id, existing: false, promise };
  }

  /** Resolve all pending requests for a session (e.g., on SessionEnd). */
  resolveSession(sessionId: string, decision: PermissionDecision): number {
    let count = 0;
    for (const [id, p] of this.pending) {
      if (p.sessionId === sessionId) {
        this.decide(id, decision);
        count++;
      }
    }
    return count;
  }

  /** Get a pending request by ID. */
  get(id: string): PendingPermission | undefined {
    return this.pending.get(id);
  }

  /** List all pending requests. */
  listPending(): PendingPermission[] {
    return Array.from(this.pending.values());
  }

  /** Expire stale requests. Returns count of expired. */
  sweepExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, p] of this.pending) {
      if (now >= p.expiresAt) {
        this.decide(id, { behavior: "terminal", source: "timeout" });
        count++;
      }
    }
    return count;
  }

  /** Serializable version of a pending request (for WS broadcast, no resolve function). */
  serialize(p: PendingPermission): Record<string, unknown> {
    return {
      id: p.id,
      sessionId: p.sessionId,
      agentId: p.agentId,
      agentName: p.agentName,
      projectName: p.projectName,
      branch: p.branch,
      toolName: p.toolName,
      detail: p.detail,
      message: p.message,
      cwd: p.cwd,
      risk: p.risk,
      requestedAt: p.requestedAt,
    };
  }

  /** Get the audit log. */
  getAuditLog(limit = 100): AuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /** Recently decided — for poll endpoint to return the decision after it's made */
  private recentDecisions = new Map<string, { decision: string; reason?: string }>();

  /** Get a recent decision (for hook polling after decide). Auto-cleans after 30s. */
  getRecentDecision(id: string): { decision: string; reason?: string } | null {
    return this.recentDecisions.get(id) ?? null;
  }

  /** Store a recent decision for polling. */
  private storeRecentDecision(id: string, decision: PermissionDecision): void {
    this.recentDecisions.set(id, { decision: decision.behavior, reason: decision.reason });
    // Clean up after 30s
    setTimeout(() => this.recentDecisions.delete(id), 30_000);
  }

  /** Override decide to also store recent decision. */
  decide(id: string, decision: PermissionDecision): boolean {
    const p = this.pending.get(id);
    if (!p) return false;

    this.pending.delete(id);
    p.resolve(decision);
    this.storeRecentDecision(id, decision);

    // Audit log (no secrets)
    this.auditLog.push({
      id,
      sessionId: p.sessionId,
      projectName: p.projectName,
      toolName: p.toolName,
      detail: p.detail,
      decision: decision.behavior,
      source: decision.source,
      decidedAt: new Date().toISOString(),
    });

    // Keep audit log bounded
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }

    return true;
  }

  /** Count pending. */
  get size(): number {
    return this.pending.size;
  }
}
