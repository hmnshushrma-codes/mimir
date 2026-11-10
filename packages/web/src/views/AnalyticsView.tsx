import { useEffect, useMemo, useState } from "react";
import type {
  SessionAnalytics,
  ToolSummary,
  PermissionEvent,
  PromptAssessment,
  WasteFinding,
} from "@agent-workshop/shared";
import {
  EMPTY_TOKEN_USAGE,
  assessPrompt,
  formatCost,
  calculateCost,
  PricingRegistry,
  detectWaste,
  generatePromptRecommendation,
} from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";

const API = window.location.origin;

type SubTab = "overview" | "tools" | "permissions" | "prompts";

interface StoredSessionAnalytics {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  agentCount: number;
  subagentCount: number;
  toolCallCount: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  permissionRequests: number;
  prompt: string | null;
  computedAt: string;
}

interface ToolSummaryRow {
  toolName: string;
  category: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
}

interface StoredPermissionEvent {
  id: string;
  sessionId: string;
  agentId: string;
  toolName: string | null;
  commandPreview: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decision: string;
  waitingDurationMs: number | null;
  requestType: string;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Overview ───────────────────────────────────────────────────────

function OverviewPanel({ sessions }: { sessions: StoredSessionAnalytics[] }) {
  const totalToolCalls = sessions.reduce((s, a) => s + a.toolCallCount, 0);
  const totalFailed = sessions.reduce((s, a) => s + a.failedToolCalls, 0);
  const totalAgents = sessions.reduce((s, a) => s + a.agentCount, 0);
  const totalDuration = sessions.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const perms = sessions.reduce((s, a) => s + a.permissionRequests, 0);

  return (
    <div className="analytics-grid">
      <div className="analytics-card">
        <div className="analytics-card-value">{sessions.length}</div>
        <div className="analytics-card-label">Sessions</div>
      </div>
      <div className="analytics-card">
        <div className="analytics-card-value">{totalAgents}</div>
        <div className="analytics-card-label">Agents</div>
      </div>
      <div className="analytics-card">
        <div className="analytics-card-value">{totalToolCalls}</div>
        <div className="analytics-card-label">Tool Calls</div>
      </div>
      <div className="analytics-card">
        <div className="analytics-card-value">{totalFailed}</div>
        <div className="analytics-card-label">Failed</div>
      </div>
      <div className="analytics-card">
        <div className="analytics-card-value">{perms}</div>
        <div className="analytics-card-label">Permissions</div>
      </div>
      <div className="analytics-card">
        <div className="analytics-card-value">{formatDuration(totalDuration)}</div>
        <div className="analytics-card-label">Total Time</div>
      </div>

      <div className="analytics-section">
        <h3>Sessions</h3>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Agents</th>
              <th>Tools</th>
              <th>Failed</th>
              <th>Duration</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId}>
                <td title={s.sessionId}>{s.sessionId.slice(0, 8)}…</td>
                <td>{s.agentCount}</td>
                <td>{s.toolCallCount}</td>
                <td>{s.failedToolCalls}</td>
                <td>{formatDuration(s.durationMs)}</td>
                <td>{formatTime(s.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tools ──────────────────────────────────────────────────────────

function ToolsPanel({ summaries }: { summaries: ToolSummaryRow[] }) {
  return (
    <div className="analytics-section">
      <h3>Tool Usage Summary</h3>
      {summaries.length === 0 ? (
        <p className="analytics-empty">No tool data yet</p>
      ) : (
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Category</th>
              <th>Calls</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Retries</th>
              <th>Avg Duration</th>
              <th>Max Duration</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.toolName}>
                <td>{s.toolName}</td>
                <td>{s.category}</td>
                <td>{s.totalCalls}</td>
                <td>{s.successCount}</td>
                <td>{s.failureCount}</td>
                <td>{s.retryCount}</td>
                <td>{formatDuration(s.avgDurationMs)}</td>
                <td>{formatDuration(s.maxDurationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Permissions ────────────────────────────────────────────────────

function PermissionsPanel({ events }: { events: StoredPermissionEvent[] }) {
  const pending = events.filter((e) => e.decision === "pending");
  const resolved = events.filter((e) => e.decision !== "pending");

  return (
    <div className="analytics-section">
      {pending.length > 0 && (
        <>
          <h3>Pending ({pending.length})</h3>
          <table className="analytics-table">
            <thead><tr><th>Agent</th><th>Type</th><th>Tool</th><th>Requested</th></tr></thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td>{p.agentId.slice(0, 10)}</td>
                  <td>{p.requestType}</td>
                  <td>{p.toolName ?? "—"}</td>
                  <td>{formatTime(p.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Permission History ({resolved.length})</h3>
      {resolved.length === 0 ? (
        <p className="analytics-empty">No permission events yet</p>
      ) : (
        <table className="analytics-table">
          <thead><tr><th>Agent</th><th>Decision</th><th>Wait</th><th>Type</th><th>Time</th></tr></thead>
          <tbody>
            {resolved.map((p) => (
              <tr key={p.id}>
                <td>{p.agentId.slice(0, 10)}</td>
                <td className={`perm-${p.decision}`}>{p.decision}</td>
                <td>{formatDuration(p.waitingDurationMs)}</td>
                <td>{p.requestType}</td>
                <td>{formatTime(p.requestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Prompts ────────────────────────────────────────────────────────

function PromptsPanel({ sessions }: { sessions: StoredSessionAnalytics[] }) {
  const promptSessions = sessions.filter((s) => s.prompt);
  if (promptSessions.length === 0) {
    return <p className="analytics-empty">No prompts captured yet</p>;
  }

  return (
    <div className="analytics-section">
      <h3>Prompt Quality</h3>
      {promptSessions.map((s) => {
        const assessment = assessPrompt(s.sessionId, s.prompt!);
        return (
          <div key={s.sessionId} className="prompt-card">
            <div className="prompt-card-header">
              <span className="prompt-score" data-score={assessment.overallScore > 60 ? "good" : assessment.overallScore > 35 ? "fair" : "poor"}>
                {assessment.overallScore}/100
              </span>
              <span className="prompt-text">{s.prompt!.slice(0, 100)}{s.prompt!.length > 100 ? "…" : ""}</span>
            </div>
            {assessment.missingRequirements.length > 0 && (
              <div className="prompt-issues">
                <strong>Missing:</strong>
                <ul>
                  {assessment.missingRequirements.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {assessment.suggestedImprovements.length > 0 && (
              <div className="prompt-suggestions">
                <strong>Suggestions:</strong>
                <ul>
                  {assessment.suggestedImprovements.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────

export function AnalyticsView() {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [sessions, setSessions] = useState<StoredSessionAnalytics[]>([]);
  const [toolSummaries, setToolSummaries] = useState<ToolSummaryRow[]>([]);
  const [permissions, setPermissions] = useState<StoredPermissionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sessRes, toolRes, permRes] = await Promise.all([
          fetch(`${API}/analytics/sessions`),
          fetch(`${API}/analytics/tools/summary`),
          fetch(`${API}/analytics/permissions`),
        ]);
        if (cancelled) return;
        if (sessRes.ok) setSessions(await sessRes.json());
        if (toolRes.ok) setToolSummaries(await toolRes.json());
        if (permRes.ok) setPermissions(await permRes.json());
      } catch { /* offline */ }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) return <div className="analytics-loading">Loading analytics…</div>;

  return (
    <div className="analytics-view">
      <nav className="analytics-subtabs">
        {(["overview", "tools", "permissions", "prompts"] as SubTab[]).map((t) => (
          <button key={t} className={`subtab ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <div className="analytics-content">
        {subTab === "overview" && <OverviewPanel sessions={sessions} />}
        {subTab === "tools" && <ToolsPanel summaries={toolSummaries} />}
        {subTab === "permissions" && <PermissionsPanel events={permissions} />}
        {subTab === "prompts" && <PromptsPanel sessions={sessions} />}
      </div>
    </div>
  );
}
