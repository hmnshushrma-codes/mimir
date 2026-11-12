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
import { isDemoMode } from "../data/demoSource.js";

const API = window.location.origin;

type SubTab = "overview" | "tokens" | "tools" | "agents" | "timeline" | "compare" | "permissions" | "prompts";

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

// ─── Tokens ─────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface SubagentTokenRow {
  agentId: string;
  model: string | null;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

function TokensPanel({ data }: { data: any[] }) {
  const [subagents, setSubagents] = useState<SubagentTokenRow[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    if (!expandedSession || isDemoMode()) return;
    fetch(`${API}/analytics/tokens/${expandedSession}/subagents`)
      .then((r) => r.ok ? r.json() : [])
      .then(setSubagents)
      .catch(() => setSubagents([]));
  }, [expandedSession]);

  if (data.length === 0) {
    return <p className="analytics-empty">No usage data yet — data appears after Claude finishes a tool call</p>;
  }

  const totals = data.reduce((acc, s) => ({
    apiCalls: acc.apiCalls + (s.apiCalls ?? 0),
    input: acc.input + (s.inputTokens ?? 0),
    output: acc.output + (s.outputTokens ?? 0),
    cacheWrite: acc.cacheWrite + (s.cacheCreationTokens ?? 0),
    cacheRead: acc.cacheRead + (s.cacheReadTokens ?? 0),
    turns: acc.turns + (s.turnCount ?? 0),
  }), { apiCalls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, turns: 0 });

  const registry = new PricingRegistry();
  const model = data[0]?.model ?? "claude-opus-4-6";
  const pricing = registry.get(model);

  // Cost breakdown
  const costInput = pricing ? (totals.input / 1e6) * pricing.inputPricePerMToken : 0;
  const costOutput = pricing ? (totals.output / 1e6) * pricing.outputPricePerMToken : 0;
  const costCacheWrite = pricing ? (totals.cacheWrite / 1e6) * pricing.cacheCreationPricePerMToken : 0;
  const costCacheRead = pricing ? (totals.cacheRead / 1e6) * pricing.cacheReadPricePerMToken : 0;
  const totalCost = costInput + costOutput + costCacheWrite + costCacheRead;

  // Context window
  const latest = data[0];
  const ctxTokens = latest?.latestContextTokens ?? 0;
  const ctxLimit = 1_000_000;
  const ctxPercent = ctxLimit > 0 ? Math.round((ctxTokens / ctxLimit) * 100) : 0;

  // Words approximation (1 token ≈ 0.75 words)
  const wordsWritten = Math.round(totals.output * 0.75);
  const contextWords = Math.round(ctxTokens * 0.75);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Hero cards: what a normal person cares about ── */}
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-card-value">{totals.turns}</div>
          <div className="analytics-card-label">Conversations</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-value">{totals.apiCalls.toLocaleString()}</div>
          <div className="analytics-card-label">AI Responses</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-value">{wordsWritten >= 1000 ? `${(wordsWritten / 1000).toFixed(0)}K` : wordsWritten.toLocaleString()}</div>
          <div className="analytics-card-label">Words Written by AI</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-value" style={{ color: ctxPercent > 80 ? "var(--warn)" : ctxPercent > 95 ? "var(--error)" : "var(--ok)" }}>
            {ctxPercent}%
          </div>
          <div className="analytics-card-label">Memory Used</div>
        </div>
      </div>

      {/* ── Memory gauge ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>AI Memory (Context Window)</strong>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{contextWords.toLocaleString()} words / ~750K words max</span>
        </div>
        <div style={{ background: "var(--surface-alt)", borderRadius: 6, height: 20, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(ctxPercent, 100)}%`,
            height: "100%",
            borderRadius: 6,
            background: ctxPercent > 90 ? "var(--error)" : ctxPercent > 70 ? "var(--warn)" : "var(--ok)",
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          {ctxPercent < 50 && "Plenty of memory left. No action needed."}
          {ctxPercent >= 50 && ctxPercent < 80 && "Memory is filling up. Consider longer sessions may slow down."}
          {ctxPercent >= 80 && ctxPercent < 95 && "⚠️ Memory is getting full. Use /compact to free up space, or /clear to start fresh."}
          {ctxPercent >= 95 && "🔴 Memory almost full! Claude may forget earlier context. Use /clear to reset."}
        </div>
      </div>

      {/* ── Cost breakdown (friendly) ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 13 }}>Cost Breakdown</strong>
          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface-alt)", padding: "2px 8px", borderRadius: 4 }}>
            API-equivalent estimate · not your actual bill
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          If this session were billed at API rates ({model}). On Pro/Max plans, your actual cost is your subscription fee.
        </div>
        <table className="analytics-table">
          <thead>
            <tr><th>What</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>API Cost</th><th>What it means</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Your prompts</td>
              <td style={{ textAlign: "right" }}>{formatTokens(totals.input)}</td>
              <td style={{ textAlign: "right" }}>${costInput.toFixed(2)}</td>
              <td style={{ color: "var(--text-muted)", fontSize: 11 }}>What you typed + context sent</td>
            </tr>
            <tr>
              <td><strong>AI responses</strong></td>
              <td style={{ textAlign: "right" }}><strong>{formatTokens(totals.output)}</strong></td>
              <td style={{ textAlign: "right" }}><strong>${costOutput.toFixed(2)}</strong></td>
              <td style={{ color: "var(--text-muted)", fontSize: 11 }}>Code, explanations, tool calls</td>
            </tr>
            <tr>
              <td>New context loaded</td>
              <td style={{ textAlign: "right" }}>{formatTokens(totals.cacheWrite)}</td>
              <td style={{ textAlign: "right" }}>${costCacheWrite.toFixed(2)}</td>
              <td style={{ color: "var(--text-muted)", fontSize: 11 }}>Files, docs, code read for first time</td>
            </tr>
            <tr>
              <td>Context re-read</td>
              <td style={{ textAlign: "right" }}>{formatTokens(totals.cacheRead)}</td>
              <td style={{ textAlign: "right" }}>${costCacheRead.toFixed(2)}</td>
              <td style={{ color: "var(--text-muted)", fontSize: 11 }}>Same context re-sent each turn (cached, 90% cheaper)</td>
            </tr>
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td><strong>Total</strong></td>
              <td style={{ textAlign: "right" }}><strong>{formatTokens(totals.input + totals.output + totals.cacheWrite + totals.cacheRead)}</strong></td>
              <td style={{ textAlign: "right" }}><strong>${totalCost.toFixed(2)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Savings tips ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <strong style={{ fontSize: 13 }}>💡 How to Save Tokens</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {costCacheRead > costOutput && (
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--warn)", fontWeight: 700, minWidth: 20 }}>1.</span>
              <div>
                <strong>Context re-reads cost more than AI responses</strong> (${costCacheRead.toFixed(2)} vs ${costOutput.toFixed(2)}).
                <span style={{ color: "var(--text-muted)" }}> Use <code>/compact</code> to shrink context, or <code>/clear</code> to start fresh when switching tasks.</span>
              </div>
            </div>
          )}
          {ctxPercent > 70 && (
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--warn)", fontWeight: 700, minWidth: 20 }}>{costCacheRead > costOutput ? "2." : "1."}</span>
              <div>
                <strong>Memory is {ctxPercent}% full</strong>.
                <span style={{ color: "var(--text-muted)" }}> Each new message re-sends all {contextWords.toLocaleString()} words of context. Shorter context = faster + cheaper responses.</span>
              </div>
            </div>
          )}
          {totals.turns > 50 && (
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, minWidth: 20 }}>💬</span>
              <div>
                <strong>{totals.turns} conversations in one session</strong>.
                <span style={{ color: "var(--text-muted)" }}> Long sessions accumulate context. Consider starting a new session for unrelated tasks.</span>
              </div>
            </div>
          )}
          {totals.turns <= 50 && ctxPercent <= 70 && costCacheRead <= costOutput && (
            <div style={{ fontSize: 12, color: "var(--ok)" }}>
              ✅ Looking good! No obvious waste detected in this session.
            </div>
          )}
        </div>
      </div>

      {/* ── Per-session breakdown with subagent expansion ── */}
      {data.length > 1 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <strong style={{ fontSize: 13 }}>Per-Session Breakdown</strong>
          <table className="analytics-table" style={{ marginTop: 10 }}>
            <thead>
              <tr><th>Session</th><th>Model</th><th style={{ textAlign: "right" }}>Responses</th><th style={{ textAlign: "right" }}>Words Out</th><th style={{ textAlign: "right" }}>Turns</th><th></th></tr>
            </thead>
            <tbody>
              {data.map((s: any) => {
                const isExpanded = expandedSession === s.sessionId;
                return (
                  <tr key={s.sessionId} style={{ cursor: "pointer" }} onClick={() => setExpandedSession(isExpanded ? null : s.sessionId)}>
                    <td title={s.sessionId}>{s.sessionId?.slice(0, 8)}…</td>
                    <td style={{ fontSize: 11 }}>{s.model ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.apiCalls}</td>
                    <td style={{ textAlign: "right" }}>{formatTokens(Math.round((s.outputTokens ?? 0) * 0.75))}</td>
                    <td style={{ textAlign: "right" }}>{s.turnCount ?? 0}</td>
                    <td style={{ fontSize: 11 }}>{isExpanded ? "▼" : "▶"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Subagent breakdown (expanded) ── */}
      {expandedSession && subagents.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <strong style={{ fontSize: 13 }}>Subagents in {expandedSession.slice(0, 8)}…</strong>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 10px" }}>
            Agents spawned by Claude to handle subtasks — each uses its own tokens.
          </p>
          <table className="analytics-table">
            <thead>
              <tr><th>Agent</th><th>Model</th><th style={{ textAlign: "right" }}>Responses</th><th style={{ textAlign: "right" }}>Words Out</th><th style={{ textAlign: "right" }}>Input</th></tr>
            </thead>
            <tbody>
              {subagents.map((a) => (
                <tr key={a.agentId}>
                  <td title={a.agentId}>{a.agentId.slice(0, 12)}{a.agentId.length > 12 ? "…" : ""}</td>
                  <td style={{ fontSize: 11 }}>{a.model ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{a.apiCalls}</td>
                  <td style={{ textAlign: "right" }}>{formatTokens(Math.round(a.outputTokens * 0.75))}</td>
                  <td style={{ textAlign: "right" }}>{formatTokens(a.inputTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Agents ─────────────────────────────────────────────────────────

interface StoredToolCallAnalytics {
  toolUseId: string;
  sessionId: string;
  agentId: string;
  toolName: string;
  category: string;
  status: string;
  target: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  isRetry: boolean;
}

function AgentsPanel({ sessions }: { sessions: StoredSessionAnalytics[] }) {
  // Derive per-agent stats from sessions + tool calls
  const agentRows = useMemo(() => {
    const agents: Array<{ sessionId: string; agentId: string; agentCount: number; toolCalls: number; failed: number; duration: number | null }> = [];
    for (const s of sessions) {
      agents.push({
        sessionId: s.sessionId,
        agentId: "foreman",
        agentCount: s.agentCount,
        toolCalls: s.toolCallCount,
        failed: s.failedToolCalls,
        duration: s.durationMs,
      });
    }
    return agents;
  }, [sessions]);

  return (
    <div className="analytics-section">
      <h3>Agent Performance</h3>
      {agentRows.length === 0 ? (
        <p className="analytics-empty">No agent data yet</p>
      ) : (
        <table className="analytics-table">
          <thead>
            <tr><th>Session</th><th>Agents</th><th>Tool Calls</th><th>Failed</th><th>Duration</th></tr>
          </thead>
          <tbody>
            {agentRows.map((a, i) => (
              <tr key={i}>
                <td title={a.sessionId}>{a.sessionId.slice(0, 8)}…</td>
                <td>{a.agentCount}</td>
                <td>{a.toolCalls}</td>
                <td>{a.failed}</td>
                <td>{formatDuration(a.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────

function TimelinePanel({ sessions }: { sessions: StoredSessionAnalytics[] }) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<StoredToolCallAnalytics[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const target = selectedSession ?? sessions[0]?.sessionId;

  useEffect(() => {
    if (!target || isDemoMode()) return;
    fetch(`${API}/analytics/sessions/${target}/tools`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setToolCalls(data); setReplayIndex(null); setPlaying(false); })
      .catch(() => setToolCalls([]));
  }, [target]);

  // Replay timer
  useEffect(() => {
    if (!playing || replayIndex === null || replayIndex >= toolCalls.length - 1) {
      if (playing && replayIndex !== null && replayIndex >= toolCalls.length - 1) setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setReplayIndex((i) => (i ?? 0) + 1), 800 / speed);
    return () => clearTimeout(timer);
  }, [playing, replayIndex, toolCalls.length, speed]);

  const visibleCalls = replayIndex !== null ? toolCalls.slice(0, replayIndex + 1) : toolCalls;

  return (
    <div className="analytics-section">
      <h3>Session Timeline & Replay</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={target ?? ""}
          onChange={(e) => setSelectedSession(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }}
        >
          {sessions.map((s) => (
            <option key={s.sessionId} value={s.sessionId}>
              {s.sessionId.slice(0, 8)}… — {s.prompt?.slice(0, 40) ?? "no prompt"} ({formatTime(s.startedAt)})
            </option>
          ))}
        </select>
        <button className="subtab" onClick={() => { setReplayIndex(0); setPlaying(true); }}>
          {playing ? "⏸ Pause" : "▶ Replay"}
        </button>
        {replayIndex !== null && (
          <>
            <button className="subtab" onClick={() => setReplayIndex(Math.max(0, (replayIndex ?? 0) - 1))}>⏮ Prev</button>
            <button className="subtab" onClick={() => setReplayIndex(Math.min(toolCalls.length - 1, (replayIndex ?? 0) + 1))}>Next ⏭</button>
            <button className="subtab" onClick={() => { setReplayIndex(null); setPlaying(false); }}>Show All</button>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11 }}>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {(replayIndex ?? 0) + 1} / {toolCalls.length}
            </span>
          </>
        )}
      </div>
      {visibleCalls.length === 0 ? (
        <p className="analytics-empty">No tool calls for this session</p>
      ) : (
        <div className="timeline-list">
          {visibleCalls.map((tc, i) => (
            <div
              key={tc.toolUseId}
              className={`timeline-event timeline-${tc.status} ${replayIndex !== null && i === replayIndex ? "timeline-active" : ""}`}
            >
              <span className="timeline-time">{formatTime(tc.startedAt)}</span>
              <span className={`timeline-status status-${tc.status}`}>
                {tc.status === "succeeded" ? "✓" : tc.status === "failed" ? "✗" : "⋯"}
              </span>
              <span className="timeline-tool">{tc.toolName}</span>
              <span className="timeline-target">{tc.target ?? ""}</span>
              <span className="timeline-duration">{formatDuration(tc.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compare ────────────────────────────────────────────────────────

function ComparePanel({ sessions }: { sessions: StoredSessionAnalytics[] }) {
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");

  const a = sessions.find((s) => s.sessionId === idA);
  const b = sessions.find((s) => s.sessionId === idB);

  if (sessions.length < 2) {
    return <p className="analytics-empty">Need at least 2 sessions to compare</p>;
  }

  function row(label: string, va: string | number | null, vb: string | number | null) {
    return (
      <tr>
        <td style={{ fontWeight: 600 }}>{label}</td>
        <td>{va ?? "—"}</td>
        <td>{vb ?? "—"}</td>
      </tr>
    );
  }

  return (
    <div className="analytics-section">
      <h3>Session Comparison</h3>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <select value={idA} onChange={(e) => setIdA(e.target.value)}
          style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }}>
          <option value="">Select session A</option>
          {sessions.map((s) => (
            <option key={s.sessionId} value={s.sessionId}>{s.sessionId.slice(0, 8)}… — {s.prompt?.slice(0, 30) ?? "no prompt"}</option>
          ))}
        </select>
        <select value={idB} onChange={(e) => setIdB(e.target.value)}
          style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12 }}>
          <option value="">Select session B</option>
          {sessions.map((s) => (
            <option key={s.sessionId} value={s.sessionId}>{s.sessionId.slice(0, 8)}… — {s.prompt?.slice(0, 30) ?? "no prompt"}</option>
          ))}
        </select>
      </div>
      {a && b ? (
        <table className="analytics-table">
          <thead><tr><th>Metric</th><th>Session A</th><th>Session B</th></tr></thead>
          <tbody>
            {row("Agents", a.agentCount, b.agentCount)}
            {row("Tool Calls", a.toolCallCount, b.toolCallCount)}
            {row("Failed", a.failedToolCalls, b.failedToolCalls)}
            {row("Success Rate",
              a.toolCallCount > 0 ? `${Math.round((a.successfulToolCalls / a.toolCallCount) * 100)}%` : "—",
              b.toolCallCount > 0 ? `${Math.round((b.successfulToolCalls / b.toolCallCount) * 100)}%` : "—"
            )}
            {row("Permissions", a.permissionRequests, b.permissionRequests)}
            {row("Duration", formatDuration(a.durationMs), formatDuration(b.durationMs))}
            {row("Prompt", a.prompt?.slice(0, 50) ?? "—", b.prompt?.slice(0, 50) ?? "—")}
          </tbody>
        </table>
      ) : (
        <p className="analytics-empty">Select two sessions to compare</p>
      )}
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────

export function AnalyticsView() {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [sessions, setSessions] = useState<StoredSessionAnalytics[]>([]);
  const [toolSummaries, setToolSummaries] = useState<ToolSummaryRow[]>([]);
  const [permissions, setPermissions] = useState<StoredPermissionEvent[]>([]);
  const [tokenData, setTokenData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      // Populate with realistic simulated data — no backend calls
      setSessions([
        { sessionId: "demo-s1", projectId: "demo-proj-acme", startedAt: new Date(Date.now() - 3600000).toISOString(), endedAt: new Date(Date.now() - 2400000).toISOString(), durationMs: 1200000, agentCount: 4, subagentCount: 3, toolCallCount: 47, successfulToolCalls: 41, failedToolCalls: 6, permissionRequests: 2, prompt: "Build the analytics dashboard with charts and filters", computedAt: new Date().toISOString() },
        { sessionId: "demo-s2", projectId: "demo-proj-acme", startedAt: new Date(Date.now() - 7200000).toISOString(), endedAt: new Date(Date.now() - 5400000).toISOString(), durationMs: 1800000, agentCount: 3, subagentCount: 2, toolCallCount: 62, successfulToolCalls: 55, failedToolCalls: 7, permissionRequests: 1, prompt: "Fix authentication and add rate limiting", computedAt: new Date().toISOString() },
        { sessionId: "demo-s3", projectId: "demo-proj-acme", startedAt: new Date(Date.now() - 14400000).toISOString(), endedAt: new Date(Date.now() - 12600000).toISOString(), durationMs: 1800000, agentCount: 2, subagentCount: 1, toolCallCount: 28, successfulToolCalls: 26, failedToolCalls: 2, permissionRequests: 0, prompt: "Write unit tests for the user service", computedAt: new Date().toISOString() },
      ]);
      setToolSummaries([
        { toolName: "Read", category: "read", totalCalls: 34, successCount: 34, failureCount: 0, retryCount: 0, avgDurationMs: 180, maxDurationMs: 450 },
        { toolName: "Write", category: "write", totalCalls: 22, successCount: 20, failureCount: 2, retryCount: 2, avgDurationMs: 320, maxDurationMs: 890 },
        { toolName: "Edit", category: "write", totalCalls: 18, successCount: 15, failureCount: 3, retryCount: 3, avgDurationMs: 280, maxDurationMs: 720 },
        { toolName: "Bash", category: "shell", totalCalls: 15, successCount: 12, failureCount: 3, retryCount: 2, avgDurationMs: 2400, maxDurationMs: 8500 },
        { toolName: "Grep", category: "read", totalCalls: 12, successCount: 12, failureCount: 0, retryCount: 0, avgDurationMs: 95, maxDurationMs: 210 },
        { toolName: "Glob", category: "read", totalCalls: 8, successCount: 8, failureCount: 0, retryCount: 0, avgDurationMs: 60, maxDurationMs: 140 },
        { toolName: "Agent", category: "delegate", totalCalls: 6, successCount: 6, failureCount: 0, retryCount: 0, avgDurationMs: 450, maxDurationMs: 900 },
        { toolName: "WebFetch", category: "web", totalCalls: 3, successCount: 2, failureCount: 1, retryCount: 1, avgDurationMs: 1800, maxDurationMs: 3200 },
      ]);
      setPermissions([
        { id: "perm-1", sessionId: "demo-s1", agentId: "tester-1", toolName: "Bash", commandPreview: "npm run deploy:staging", requestedAt: new Date(Date.now() - 3000000).toISOString(), decidedAt: new Date(Date.now() - 2995000).toISOString(), decision: "approved", waitingDurationMs: 5000, requestType: "permission" },
        { id: "perm-2", sessionId: "demo-s1", agentId: "builder-1", toolName: "Bash", commandPreview: "rm -rf dist/", requestedAt: new Date(Date.now() - 2800000).toISOString(), decidedAt: new Date(Date.now() - 2790000).toISOString(), decision: "approved", waitingDurationMs: 10000, requestType: "permission" },
        { id: "perm-3", sessionId: "demo-s2", agentId: "main", toolName: "Bash", commandPreview: "npm run migrate:prod", requestedAt: new Date(Date.now() - 6000000).toISOString(), decidedAt: new Date(Date.now() - 5985000).toISOString(), decision: "denied", waitingDurationMs: 15000, requestType: "permission" },
      ]);
      setTokenData([
        { sessionId: "demo-s1", model: "claude-opus-4-6", apiCalls: 245, inputTokens: 890, outputTokens: 85200, cacheCreationTokens: 1250000, cacheReadTokens: 142000000, latestContextTokens: 620000, totalTurnDurationMs: 3600000, turnCount: 28 },
        { sessionId: "demo-s2", model: "claude-sonnet-4-6", apiCalls: 180, inputTokens: 650, outputTokens: 42000, cacheCreationTokens: 890000, cacheReadTokens: 95000000, latestContextTokens: 380000, totalTurnDurationMs: 2400000, turnCount: 22 },
      ]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [sessRes, toolRes, permRes, tokRes] = await Promise.all([
          fetch(`${API}/analytics/sessions`),
          fetch(`${API}/analytics/tools/summary`),
          fetch(`${API}/analytics/permissions`),
          fetch(`${API}/analytics/tokens`),
        ]);
        if (cancelled) return;
        if (sessRes.ok) setSessions(await sessRes.json());
        if (toolRes.ok) setToolSummaries(await toolRes.json());
        if (permRes.ok) setPermissions(await permRes.json());
        if (tokRes.ok) setTokenData(await tokRes.json());
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
        {(["overview", "tokens", "tools", "agents", "timeline", "compare", "permissions", "prompts"] as SubTab[]).map((t) => (
          <button key={t} className={`subtab ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <div className="analytics-content">
        {subTab === "overview" && <OverviewPanel sessions={sessions} />}
        {subTab === "tokens" && <TokensPanel data={tokenData} />}
        {subTab === "tools" && <ToolsPanel summaries={toolSummaries} />}
        {subTab === "agents" && <AgentsPanel sessions={sessions} />}
        {subTab === "timeline" && <TimelinePanel sessions={sessions} />}
        {subTab === "compare" && <ComparePanel sessions={sessions} />}
        {subTab === "permissions" && <PermissionsPanel events={permissions} />}
        {subTab === "prompts" && <PromptsPanel sessions={sessions} />}
      </div>
    </div>
  );
}
