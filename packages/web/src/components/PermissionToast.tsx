/**
 * Permission request toast — non-blocking popup showing what Claude Code
 * is waiting for. Phase A: information only, no action buttons.
 * "Answer in your terminal."
 */

import { useEffect, useRef, useState } from "react";
import type { PermissionRequestPayload } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import { useNow } from "../hooks/useNow.js";

// ── Settings (localStorage) ─────────────────────────────────

const NOTIF_KEY = "mimir:perm-notifications:v1";
const SOUND_KEY = "mimir:perm-sound:v1";

function loadBool(key: string): boolean {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}
function saveBool(key: string, v: boolean): void {
  try { localStorage.setItem(key, String(v)); } catch { /* noop */ }
}

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
  return (
    <span className="perm-risk-badge" style={{ background: info.color }}>
      {info.label}
    </span>
  );
}

// ── Waiting timer ───────────────────────────────────────────

function WaitingTimer({ since, nowMs }: { since: string; nowMs: number }) {
  const elapsed = nowMs - Date.parse(since);
  if (!Number.isFinite(elapsed) || elapsed < 0) return <span>0s</span>;
  const secs = Math.floor(elapsed / 1000);
  if (secs < 60) return <span>{secs}s</span>;
  return <span>{Math.floor(secs / 60)}m {secs % 60}s</span>;
}

// ── Permission card ─────────────────────────────────────────

function PermissionCard({ perm, nowMs }: { perm: PermissionRequestPayload; nowMs: number }) {
  return (
    <div className={`perm-toast-card ${perm.risk === "destructive" ? "perm-destructive" : ""}`}>
      <div className="perm-toast-header">
        <span className="perm-toast-icon">🖐</span>
        <span className="perm-toast-title">Permission Required</span>
        <RiskBadge risk={perm.risk} />
      </div>

      <div className="perm-toast-meta">
        <span title={perm.sessionId}>{perm.projectName ?? "unknown"}</span>
        {perm.branch && <span className="perm-toast-branch">{perm.branch}</span>}
        <span className="perm-toast-agent">{perm.agentName ?? perm.agentId}</span>
        <span className="perm-toast-session">{perm.sessionId.slice(0, 8)}…</span>
      </div>

      {perm.toolName && (
        <div className="perm-toast-tool">
          <span className="perm-toast-tool-name">{perm.toolName}</span>
          {perm.detail && (
            <code className="perm-toast-detail">{perm.detail}</code>
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
        <span className="perm-toast-hint">Answer in your terminal</span>
      </div>
    </div>
  );
}

// ── Soft notification sound ─────────────────────────────────

function playNotifSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* audio not available */ }
}

// ── Main container ──────────────────────────────────────────

export function PermissionToastContainer() {
  const permissions = useWorkshopStore((s) => s.pendingPermissions);
  const nowMs = useNow();
  const [notifEnabled, setNotifEnabled] = useState(() => loadBool(NOTIF_KEY));
  const [soundEnabled, setSoundEnabled] = useState(() => loadBool(SOUND_KEY));
  const [showSettings, setShowSettings] = useState(false);
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  // Browser notification + sound on new permission
  useEffect(() => {
    for (const p of permissions) {
      if (lastNotifiedRef.current.has(p.id)) continue;
      lastNotifiedRef.current.add(p.id);

      if (soundEnabled) playNotifSound();

      if (notifEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const body = p.detail
          ? `${p.toolName}: ${p.detail.slice(0, 100)}`
          : p.message ?? "Permission needed";
        new Notification("Mimir — Permission Required", {
          body,
          icon: "/favicon.ico",
          tag: p.id,
          requireInteraction: false,
        });
      }
    }
    // Clean up old IDs
    const currentIds = new Set(permissions.map((p) => p.id));
    for (const id of lastNotifiedRef.current) {
      if (!currentIds.has(id)) lastNotifiedRef.current.delete(id);
    }
  }, [permissions, notifEnabled, soundEnabled]);

  // Update document title with pending count
  useEffect(() => {
    const base = "Mimir";
    if (permissions.length > 0) {
      document.title = `(${permissions.length}) 🖐 ${base}`;
    } else {
      document.title = base;
    }
    return () => { document.title = base; };
  }, [permissions.length]);

  if (permissions.length === 0 && !showSettings) return null;

  return (
    <div className="perm-toast-container">
      {/* Settings toggle */}
      <div className="perm-toast-settings-row">
        <button
          className="perm-settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Notification settings"
        >
          ⚙
        </button>
        {permissions.length > 1 && (
          <span className="perm-toast-count">{permissions.length} pending</span>
        )}
      </div>

      {showSettings && (
        <div className="perm-toast-settings">
          <label>
            <input
              type="checkbox"
              checked={notifEnabled}
              onChange={(e) => {
                const v = e.target.checked;
                if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
                  Notification.requestPermission();
                }
                setNotifEnabled(v);
                saveBool(NOTIF_KEY, v);
              }}
            />
            Browser notifications
          </label>
          <label>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => { setSoundEnabled(e.target.checked); saveBool(SOUND_KEY, e.target.checked); }}
            />
            Sound alert
          </label>
        </div>
      )}

      {permissions.map((p) => (
        <PermissionCard key={p.id} perm={p} nowMs={nowMs} />
      ))}
    </div>
  );
}
