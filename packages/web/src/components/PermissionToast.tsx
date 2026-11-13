/**
 * Permission panel — Phase B: docked side panel with Allow/Deny buttons.
 * Shows one active request in detail, with a compact queue list.
 * Falls back to Phase A (info-only) when remote approval is not connected.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PermissionRequestPayload } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { useNow } from "../hooks/useNow.js";
import { isDemoMode } from "../data/demoSource.js";

const API = window.location.origin;

// ── Risk badge ──────────────────────────────────────────────

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  destructive: { label: "DESTRUCTIVE", color: "#e34948" },
  external: { label: "EXTERNAL", color: "#e5a100" },
  elevated: { label: "ELEVATED", color: "#d97706" },
};

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null;
  const info = RISK_LABELS[risk];
  if (!info) return null;
  return <span className="perm-risk-badge" style={{ background: info.color }}>{info.label}</span>;
}

// ── Waiting timer ───────────────────────────────────────────

function WaitingTimer({ since, nowMs }: { since: string; nowMs: number }) {
  const elapsed = nowMs - Date.parse(since);
  if (!Number.isFinite(elapsed) || elapsed < 0) return <span>0s</span>;
  const secs = Math.floor(elapsed / 1000);
  if (secs < 60) return <span>{secs}s</span>;
  return <span>{Math.floor(secs / 60)}m {secs % 60}s</span>;
}

// ── Token cache ─────────────────────────────────────────────

let cachedToken: string | null = null;
async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (isDemoMode()) return "demo-token";
  try {
    const res = await fetch(`${API}/permissions/token`);
    if (!res.ok) return null;
    const data = await res.json();
    cachedToken = data.token ?? null;
    return cachedToken;
  } catch {
    return null;
  }
}

async function sendDecision(id: string, decision: "allow" | "deny", reason?: string): Promise<boolean> {
  if (isDemoMode()) return true;
  const token = await getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API}/permissions/decide`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mimir-token": token },
      body: JSON.stringify({ id, decision, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Active request detail card ──────────────────────────────

function ActiveRequestCard({ perm, nowMs, onAllow, onDeny, onTerminal, onDismiss, remoteConnected }: {
  perm: PermissionRequestPayload;
  nowMs: number;
  onAllow: () => void;
  onDeny: (reason?: string) => void;
  onTerminal: () => void;
  onDismiss: () => void;
  remoteConnected: boolean;
}) {
  const isDestructive = perm.risk === "destructive";
  const [confirmAllow, setConfirmAllow] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleAllow = useCallback(() => {
    if (isDestructive && !confirmAllow) {
      setConfirmAllow(true);
      confirmTimer.current = setTimeout(() => setConfirmAllow(false), 3000);
      return;
    }
    onAllow();
  }, [isDestructive, confirmAllow, onAllow]);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  // Keyboard shortcuts (Y/N) only when not destructive and remote connected
  useEffect(() => {
    if (!remoteConnected) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isDestructive) return;
      if (e.key === "y" || e.key === "Y") { e.preventDefault(); onAllow(); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); onDeny(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [remoteConnected, isDestructive, onAllow, onDeny]);

  return (
    <div className={`perm-active-card ${isDestructive ? "perm-destructive" : ""}`}>
      <div className="perm-toast-header">
        <span className="perm-toast-icon">🖐</span>
        <span className="perm-toast-title">Permission Required</span>
        <RiskBadge risk={perm.risk} />
        <button className="perm-close-btn" onClick={onDismiss} title="Dismiss (answer in terminal)">✕</button>
      </div>

      <div className="perm-toast-meta">
        <span>{perm.projectName ?? "unknown"}</span>
        {perm.branch && <span className="perm-toast-branch">{perm.branch}</span>}
        <span className="perm-toast-agent">{perm.agentName ?? perm.agentId}</span>
        <span className="perm-toast-session">{perm.sessionId.slice(0, 8)}…</span>
      </div>

      {perm.toolName && (
        <div className="perm-tool-block">
          <div className="perm-tool-header">{perm.toolName}</div>
          {perm.detail && (
            <pre className="perm-tool-detail">{perm.detail}</pre>
          )}
        </div>
      )}

      {perm.message && !perm.detail && (
        <div className="perm-toast-message">{perm.message}</div>
      )}

      <div className="perm-toast-footer">
        <span className="perm-toast-waiting">
          Waiting <WaitingTimer since={perm.requestedAt} nowMs={nowMs} />
        </span>
        <span className="perm-toast-hint">
          {remoteConnected ? "Waiting for you (dashboard or terminal)" : "Answer in your terminal"}
        </span>
      </div>

      {remoteConnected && (
        <div className="perm-actions">
          <button
            className={`perm-btn perm-btn-deny ${isDestructive ? "perm-btn-default" : ""}`}
            onClick={() => onDeny()}
          >
            Deny {!isDestructive && <kbd>N</kbd>}
          </button>
          <button className="perm-btn perm-btn-terminal" onClick={onTerminal}>
            Terminal
          </button>
          <button
            className={`perm-btn perm-btn-allow ${!isDestructive ? "perm-btn-default" : ""} ${confirmAllow ? "perm-btn-confirming" : ""}`}
            onClick={handleAllow}
          >
            {isDestructive && !confirmAllow ? "Allow…" : confirmAllow ? "Confirm Allow" : "Allow"} {!isDestructive && <kbd>Y</kbd>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Queue item ──────────────────────────────────────────────

function QueueItem({ perm, nowMs, onClick, onDismiss }: {
  perm: PermissionRequestPayload;
  nowMs: number;
  onClick: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="perm-queue-item" onClick={onClick}>
      <RiskBadge risk={perm.risk} />
      <span className="perm-queue-tool">{perm.toolName}</span>
      <span className="perm-queue-detail">{perm.detail?.slice(0, 40) ?? perm.message?.slice(0, 40) ?? ""}</span>
      <span className="perm-queue-time"><WaitingTimer since={perm.requestedAt} nowMs={nowMs} /></span>
      <button className="perm-close-btn perm-close-sm" onClick={(e) => { e.stopPropagation(); onDismiss(); }} title="Dismiss">✕</button>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────

export function PermissionToastContainer() {
  const permissions = useWorkshopStore((s) => s.pendingPermissions);
  const resolvedMessages = useWorkshopStore((s) => s.resolvedMessages);
  const remoteConnected = useWorkshopStore((s) => s.remoteApprovalConnected);
  const resolvePermission = useWorkshopStore((s) => s.resolvePermission);
  const nowMs = useNow();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isDemoMode()) {
      useWorkshopStore.getState().setRemoteApproval(true);
      return;
    }
    getToken().then((t) => useWorkshopStore.getState().setRemoteApproval(!!t));
  }, []);

  useEffect(() => {
    const base = "Mimir";
    document.title = permissions.length > 0 ? `(${permissions.length}) 🖐 ${base}` : base;
    return () => { document.title = base; };
  }, [permissions.length]);

  const safeIdx = Math.min(activeIndex, Math.max(0, permissions.length - 1));
  const active = permissions[safeIdx];
  const queue = permissions.filter((_, i) => i !== safeIdx);

  const handleAllow = useCallback(async () => {
    if (!active) return;
    const ok = await sendDecision(active.id, "allow");
    if (ok || isDemoMode()) resolvePermission(active.id, "Allowed from dashboard");
  }, [active, resolvePermission]);

  const handleDeny = useCallback(async (reason?: string) => {
    if (!active) return;
    const ok = await sendDecision(active.id, "deny", reason);
    if (ok || isDemoMode()) resolvePermission(active.id, "Denied from dashboard");
  }, [active, resolvePermission]);

  const handleTerminal = useCallback(() => {
    if (!active) return;
    resolvePermission(active.id, "Deciding in terminal");
  }, [active, resolvePermission]);

  const resolvedEntries = Object.entries(resolvedMessages);

  if (permissions.length === 0 && resolvedEntries.length === 0) return null;

  return (
    <div className="perm-panel">
      {resolvedEntries.map(([id, msg]) => (
        <div key={id} className="perm-resolved-msg">{msg}</div>
      ))}

      {active && (
        <ActiveRequestCard
          perm={active}
          nowMs={nowMs}
          onAllow={handleAllow}
          onDeny={handleDeny}
          onTerminal={handleTerminal}
          onDismiss={() => resolvePermission(active.id, "Dismissed")}
          remoteConnected={remoteConnected}
        />
      )}

      {queue.length > 0 && (
        <div className="perm-queue">
          <div className="perm-queue-header">{queue.length} more pending</div>
          {queue.map((p) => (
            <QueueItem key={p.id} perm={p} nowMs={nowMs} onClick={() => setActiveIndex(permissions.indexOf(p))} onDismiss={() => resolvePermission(p.id, "Dismissed")} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PermissionBadge() {
  const count = useWorkshopStore((s) => s.pendingPermissions.length);
  if (count === 0) return null;
  return <span className="perm-header-badge">🖐 {count}</span>;
}
