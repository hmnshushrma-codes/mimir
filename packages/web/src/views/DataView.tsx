import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveMetrics } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import "../styles/data-theme.css";

// ── Constants ───────────────────────────────────────────────────────

const API = window.location.origin;
const THROTTLE_MS = 1000;
const ANIMATE_MS = 400;

type SidebarPage =
  | "overview" | "sessions" | "tools" | "files"
  | "git" | "projects" | "tokens" | "waste" | "permissions";

const SIDEBAR_ITEMS: { key: SidebarPage; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "tools", label: "Tools" },
  { key: "files", label: "Files" },
  { key: "git", label: "Git" },
  { key: "projects", label: "Projects" },
  { key: "tokens", label: "Tokens" },
  { key: "waste", label: "Waste" },
  { key: "permissions", label: "Permissions" },
];

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";

const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

function timeRangeMs(range: TimeRange): number {
  switch (range) {
    case "1h": return 3_600_000;
    case "24h": return 86_400_000;
    case "7d": return 604_800_000;
    case "30d": return 2_592_000_000;
    case "all": return Infinity;
  }
}

// ── URL param helpers ───────────────────────────────────────────────

function readPageParam(): SidebarPage {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("page");
  if (raw && SIDEBAR_ITEMS.some((i) => i.key === raw)) return raw as SidebarPage;
  return "overview";
}

function writePageParam(page: SidebarPage) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", page);
  window.history.replaceState(null, "", url.toString());
}

// ── Animation helpers ───────────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useAnimatedValue(target: number): number {
  const [display, setDisplay] = useState(target);
  const raf = useRef(0);
  const startVal = useRef(target);
  const startTime = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(target);
      return;
    }
    startVal.current = display;
    startTime.current = performance.now();
    cancelAnimationFrame(raf.current);

    function tick(now: number) {
      const elapsed = now - startTime.current;
      const t = Math.min(elapsed / ANIMATE_MS, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const value = startVal.current + (target - startVal.current) * ease;
      setDisplay(Math.round(value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

// ── Formatting ──────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtCost(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Token data types ────────────────────────────────────────────────

interface TokenBucket {
  sessionId: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  apiCalls: number;
  timestamp?: string;
}

// ── KPI Card ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  sublabel?: string;
  isEmpty: boolean;
}

function KpiCard({ label, value, prefix, suffix, color, sublabel, isEmpty }: KpiCardProps) {
  const animated = useAnimatedValue(isEmpty ? 0 : value);
  const displayValue = isEmpty
    ? "\u2014"
    : `${prefix ?? ""}${fmtNum(animated)}${suffix ?? ""}`;

  return (
    <div
      style={{
        background: "var(--dv-bg-card)",
        border: "1px solid var(--dv-border)",
        borderRadius: "var(--dv-radius-card)",
        padding: "var(--dv-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--dv-text-secondary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.1,
          color: color ?? "var(--dv-text-heading)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayValue}
      </span>
      <span style={{ fontSize: 12, color: "var(--dv-text-secondary)", marginTop: 2 }}>
        {isEmpty ? "waiting for activity" : (sublabel ?? "\u00A0")}
      </span>
    </div>
  );
}

// ── Cost KPI (always shows sublabel) ────────────────────────────────

function CostKpiCard({ value, isEmpty }: { value: number; isEmpty: boolean }) {
  const animated = useAnimatedValue(isEmpty ? 0 : Math.round(value * 1000));
  const display = isEmpty ? "\u2014" : fmtCost(animated / 1000);

  return (
    <div
      style={{
        background: "var(--dv-bg-card)",
        border: "1px solid var(--dv-border)",
        borderRadius: "var(--dv-radius-card)",
        padding: "var(--dv-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--dv-text-secondary)",
        }}
      >
        Cost
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.1,
          color: "var(--dv-amber)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </span>
      <span style={{ fontSize: 12, color: "var(--dv-text-secondary)", marginTop: 2 }}>
        {isEmpty ? "waiting for activity" : "API-equivalent est."}
      </span>
    </div>
  );
}

// ── Tool Usage Bar Chart (SVG) ──────────────────────────────────────

function ToolBarChart({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Tool Usage</span>
        <span style={{ color: "var(--dv-text-secondary)", fontSize: 13, padding: 24 }}>
          No tool data yet
        </span>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top8 = sorted.slice(0, 8);
  const otherCount = sorted.slice(8).reduce((s, d) => s + d.count, 0);
  const items = otherCount > 0 ? [...top8, { name: "Other", count: otherCount }] : top8;
  const max = Math.max(...items.map((d) => d.count), 1);

  const barH = 26;
  const gap = 6;
  const labelW = 90;
  const countW = 50;
  const chartW = 500;
  const svgW = labelW + chartW + countW + 12;
  const svgH = items.length * (barH + gap);

  return (
    <div style={chartContainerStyle}>
      <span style={chartTitleStyle}>Tool Usage</span>
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="Tool usage horizontal bar chart"
      >
        {items.map((item, i) => {
          const y = i * (barH + gap);
          const barW = (item.count / max) * chartW;
          return (
            <g key={item.name}>
              <text
                x={labelW - 8}
                y={y + barH / 2}
                textAnchor="end"
                dominantBaseline="central"
                fill="var(--dv-text)"
                fontSize={12}
                fontFamily="var(--dv-font)"
              >
                {item.name}
              </text>
              <rect
                x={labelW}
                y={y + 2}
                width={Math.max(barW, 2)}
                height={barH - 4}
                rx={4}
                fill="var(--dv-green)"
                opacity={0.85}
              />
              <text
                x={labelW + Math.max(barW, 2) + 8}
                y={y + barH / 2}
                dominantBaseline="central"
                fill="var(--dv-text-secondary)"
                fontSize={12}
                fontFamily="var(--dv-font-mono)"
              >
                {fmtNum(item.count)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Tokens Over Time Stacked Column Chart (SVG) ─────────────────────

interface TokenTimePoint {
  label: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function TokensColumnChart({ data }: { data: TokenTimePoint[] }) {
  if (data.length === 0) {
    return (
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Tokens Over Time</span>
        <span style={{ color: "var(--dv-text-secondary)", fontSize: 13, padding: 24 }}>
          No token data yet
        </span>
      </div>
    );
  }

  const padT = 16;
  const padB = 40;
  const padL = 52;
  const padR = 16;
  const chartW = 560;
  const chartH = 200;
  const svgW = padL + chartW + padR;
  const svgH = padT + chartH + padB;

  const maxTotal = Math.max(
    ...data.map((d) => d.input + d.output + d.cacheRead + d.cacheWrite),
    1,
  );

  const colW = Math.max(Math.min(chartW / data.length - 4, 40), 6);

  const legendItems = [
    { label: "Input", color: "var(--dv-token-input)" },
    { label: "Output", color: "var(--dv-token-output)" },
    { label: "Cache Read", color: "var(--dv-token-cache-read)" },
    { label: "Cache Write", color: "var(--dv-token-cache-write)" },
  ];

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxTotal * f));

  return (
    <div style={chartContainerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={chartTitleStyle}>Tokens Over Time</span>
        <div style={{ display: "flex", gap: 12 }}>
          {legendItems.map((l) => (
            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--dv-text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: "inline-block" }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: "block" }}
        role="img"
        aria-label="Tokens over time stacked column chart"
      >
        {/* Y-axis grid */}
        {yTicks.map((tick) => {
          const y = padT + chartH - (tick / maxTotal) * chartH;
          return (
            <g key={tick}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="var(--dv-border)" strokeWidth={1} />
              <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="central" fill="var(--dv-text-secondary)" fontSize={10} fontFamily="var(--dv-font-mono)">
                {fmtNum(tick)}
              </text>
            </g>
          );
        })}

        {/* Stacked columns */}
        {data.map((d, i) => {
          const x = padL + (i / data.length) * chartW + (chartW / data.length - colW) / 2;
          const segments = [
            { val: d.input, color: "var(--dv-token-input)" },
            { val: d.output, color: "var(--dv-token-output)" },
            { val: d.cacheRead, color: "var(--dv-token-cache-read)" },
            { val: d.cacheWrite, color: "var(--dv-token-cache-write)" },
          ];
          let yOffset = padT + chartH;
          return (
            <g key={i}>
              {segments.map((seg, si) => {
                const h = (seg.val / maxTotal) * chartH;
                yOffset -= h;
                return (
                  <rect
                    key={si}
                    x={x}
                    y={yOffset}
                    width={colW}
                    height={Math.max(h, 0)}
                    rx={si === segments.length - 1 ? 3 : 0}
                    fill={seg.color}
                    opacity={0.85}
                  />
                );
              })}
              <text
                x={x + colW / 2}
                y={padT + chartH + 16}
                textAnchor="middle"
                fill="var(--dv-text-secondary)"
                fontSize={10}
                fontFamily="var(--dv-font)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Recent Sessions Table ───────────────────────────────────────────

interface SessionRow {
  id: string;
  projectName: string;
  status: "active" | "idle" | "ended";
  startedAt: string;
  durationMs: number;
  toolCalls: number;
  failedCalls: number;
  tokens: number;
  cost: number;
}

function statusDot(status: "active" | "idle" | "ended"): { color: string; label: string } {
  switch (status) {
    case "active": return { color: "var(--dv-green)", label: "Active" };
    case "idle": return { color: "var(--dv-amber)", label: "Idle" };
    case "ended": return { color: "var(--dv-text-secondary)", label: "Ended" };
  }
}

function SessionsTable({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Recent Sessions</span>
        <span style={{ color: "var(--dv-text-secondary)", fontSize: 13, padding: 24 }}>
          No sessions yet
        </span>
      </div>
    );
  }

  return (
    <div style={chartContainerStyle}>
      <span style={chartTitleStyle}>Recent Sessions</span>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Project", "Status", "Started", "Duration", "Tools", "Failed", "Tokens", "Cost"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Project" || h === "Status" || h === "Started" ? "left" : "right",
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--dv-text-secondary)",
                      borderBottom: "1px solid var(--dv-border)",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dot = statusDot(r.status);
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                  <td style={cellStyle}>{r.projectName}</td>
                  <td style={cellStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: dot.color,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {dot.label}
                    </span>
                  </td>
                  <td style={cellStyle}>{relativeTime(r.startedAt)}</td>
                  <td style={cellStyleRight}>{fmtDuration(r.durationMs)}</td>
                  <td style={cellStyleRight}>{r.toolCalls}</td>
                  <td style={{ ...cellStyleRight, color: r.failedCalls > 0 ? "var(--dv-red)" : undefined }}>
                    {r.failedCalls}
                  </td>
                  <td style={cellStyleRight}>{fmtNum(r.tokens)}</td>
                  <td style={{ ...cellStyleRight, color: "var(--dv-amber)" }}>{fmtCost(r.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "10px 10px", textAlign: "left", color: "var(--dv-text)" };
const cellStyleRight: React.CSSProperties = { ...cellStyle, textAlign: "right", fontFamily: "var(--dv-font-mono)", fontSize: 12 };

// ── Shared chart container style ────────────────────────────────────

const chartContainerStyle: React.CSSProperties = {
  background: "var(--dv-bg-card)",
  border: "1px solid var(--dv-border)",
  borderRadius: "var(--dv-radius-card)",
  padding: "var(--dv-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--dv-text-heading)",
};

// ── Overview Page ───────────────────────────────────────────────────

function OverviewPage({
  sessions,
  projects,
  tokenData,
  pendingPermissions,
  timeRange,
}: {
  sessions: Record<string, import("@agent-workshop/shared").SerializedSession>;
  projects: Record<string, import("@agent-workshop/shared").SerializedProject>;
  tokenData: TokenBucket[];
  pendingPermissions: import("@agent-workshop/shared").PermissionRequestPayload[];
  timeRange: TimeRange;
}) {
  const timeline = useWorkshopStore((s) => s.timeline);

  // Derive all metrics from timeline events
  const events = useMemo(() => timeline.map((t) => t.event), [timeline]);
  const derived = useMemo(() => deriveMetrics(events), [events]);

  // Filter sessions by time range
  const filteredSessions = useMemo(() => {
    const cutoff = Date.now() - timeRangeMs(timeRange);
    return Object.values(sessions).filter(
      (s) => timeRange === "all" || Date.parse(s.startedAt) >= cutoff,
    );
  }, [sessions, timeRange]);

  // Aggregate token data
  const tokenTotals = useMemo(() => {
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
    for (const t of tokenData) {
      input += t.inputTokens ?? 0;
      output += t.outputTokens ?? 0;
      cacheRead += t.cacheReadTokens ?? 0;
      cacheWrite += t.cacheCreationTokens ?? 0;
    }
    // Approximate cost at Sonnet rates: $3/M input, $15/M output, $3.75/M cache-write, $0.30/M cache-read
    cost = (input / 1e6) * 3 + (output / 1e6) * 15 + (cacheWrite / 1e6) * 3.75 + (cacheRead / 1e6) * 0.30;
    return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite, cost };
  }, [tokenData]);

  // Waste tokens: approximate as cache-read tokens that re-send unchanged context
  const wasteTokens = useMemo(() => {
    // Heuristic: if cache-read is >80% of total, the excess above 50% is "waste"
    const ratio = tokenTotals.total > 0 ? tokenTotals.cacheRead / tokenTotals.total : 0;
    if (ratio > 0.5) return Math.round(tokenTotals.cacheRead * (ratio - 0.5));
    return 0;
  }, [tokenTotals]);

  const isEmpty = filteredSessions.length === 0 && derived.totalToolCalls === 0;

  // Build tool usage data from timeline
  const toolUsageData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (e.hookEventName === "PreToolUse" && e.toolName) {
        counts[e.toolName] = (counts[e.toolName] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [events]);

  // Build token timeline data for chart
  const tokenTimeData = useMemo((): TokenTimePoint[] => {
    if (tokenData.length === 0) return [];
    // Group by session as time buckets
    return tokenData.slice(0, 12).map((t, i) => ({
      label: t.sessionId ? t.sessionId.slice(0, 6) : `#${i + 1}`,
      input: t.inputTokens ?? 0,
      output: t.outputTokens ?? 0,
      cacheRead: t.cacheReadTokens ?? 0,
      cacheWrite: t.cacheCreationTokens ?? 0,
    }));
  }, [tokenData]);

  // Build session rows for table
  const sessionRows = useMemo((): SessionRow[] => {
    return filteredSessions
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, 20)
      .map((s) => {
        const proj = projects[s.projectId];
        const totalTools = s.agents.reduce(
          (sum, a) => sum + a.activeToolCalls.length + a.finishedToolCalls.length,
          0,
        );
        const failedTools = s.agents.reduce(
          (sum, a) => sum + a.finishedToolCalls.filter((tc) => tc.status === "failed").length,
          0,
        );
        const durationMs = Date.parse(s.lastEventAt) - Date.parse(s.startedAt);
        // Approximate tokens per session from token data
        const td = tokenData.find((t) => t.sessionId === s.id);
        const tokens = td
          ? (td.inputTokens ?? 0) + (td.outputTokens ?? 0) + (td.cacheReadTokens ?? 0) + (td.cacheCreationTokens ?? 0)
          : 0;
        const cost = td
          ? ((td.inputTokens ?? 0) / 1e6) * 3 + ((td.outputTokens ?? 0) / 1e6) * 15
          : 0;

        return {
          id: s.id,
          projectName: proj?.name ?? s.projectId.slice(0, 12),
          status: s.status as "active" | "idle" | "ended",
          startedAt: s.startedAt,
          durationMs: Math.max(durationMs, 0),
          toolCalls: totalTools,
          failedCalls: failedTools,
          tokens,
          cost,
        };
      });
  }, [filteredSessions, projects, tokenData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-lg)" }}>
      {/* KPI Grid: 6 columns x 2 rows */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "var(--dv-space-md)",
        }}
      >
        <KpiCard label="Sessions" value={filteredSessions.length} isEmpty={isEmpty} />
        <KpiCard label="Tool Calls" value={derived.totalToolCalls} isEmpty={isEmpty} />
        <KpiCard label="Lines Added" value={derived.linesAdded} prefix="+" color="var(--dv-green)" sublabel="approx." isEmpty={isEmpty} />
        <KpiCard label="Lines Removed" value={derived.linesRemoved} prefix="-" color="var(--dv-red)" sublabel="approx." isEmpty={isEmpty} />
        <KpiCard label="Files Modified" value={derived.filesModified} isEmpty={isEmpty} />
        <KpiCard label="Success Rate" value={derived.successRate} suffix="%" color="var(--dv-green)" isEmpty={isEmpty} />
        <KpiCard label="Git Operations" value={derived.gitOperations} isEmpty={isEmpty} />
        <KpiCard label="MCP Calls" value={derived.mcpCalls} isEmpty={isEmpty} />
        <KpiCard label="Tokens" value={tokenTotals.total} color="var(--dv-blue)" isEmpty={isEmpty} />
        <CostKpiCard value={tokenTotals.cost} isEmpty={isEmpty} />
        <KpiCard label="Waste Tokens" value={wasteTokens} color="var(--dv-amber)" isEmpty={isEmpty} />
        <KpiCard label="Pending Permissions" value={pendingPermissions.length} isEmpty={isEmpty && pendingPermissions.length === 0} />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--dv-space-md)" }}>
        <ToolBarChart data={toolUsageData} />
        <TokensColumnChart data={tokenTimeData} />
      </div>

      {/* Recent sessions */}
      <SessionsTable rows={sessionRows} />
    </div>
  );
}

// ── Sessions Page ──────────────────────────────────────────────────

function SessionsPage({
  sessions,
  projects,
  tokenData,
}: {
  sessions: Record<string, import("@agent-workshop/shared").SerializedSession>;
  projects: Record<string, import("@agent-workshop/shared").SerializedProject>;
  tokenData: TokenBucket[];
}) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("Started");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo((): SessionRow[] => {
    return Object.values(sessions).map((s) => {
      const proj = projects[s.projectId];
      const totalTools = s.agents.reduce((sum, a) => sum + a.activeToolCalls.length + a.finishedToolCalls.length, 0);
      const failedTools = s.agents.reduce((sum, a) => sum + a.finishedToolCalls.filter((tc) => tc.status === "failed").length, 0);
      const durationMs = Date.parse(s.lastEventAt) - Date.parse(s.startedAt);
      const td = tokenData.find((t) => t.sessionId === s.id);
      const tokens = td ? (td.inputTokens ?? 0) + (td.outputTokens ?? 0) + (td.cacheReadTokens ?? 0) + (td.cacheCreationTokens ?? 0) : 0;
      const cost = td ? ((td.inputTokens ?? 0) / 1e6) * 3 + ((td.outputTokens ?? 0) / 1e6) * 15 : 0;
      return {
        id: s.id,
        projectName: proj?.name ?? s.projectId.slice(0, 12),
        status: s.status as "active" | "idle" | "ended",
        startedAt: s.startedAt,
        durationMs: Math.max(durationMs, 0),
        toolCalls: totalTools,
        failedCalls: failedTools,
        tokens,
        cost,
        _agents: s.agents.length,
      } as SessionRow & { _agents: number };
    });
  }, [sessions, projects, tokenData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = q ? rows.filter((r) => r.projectName.toLowerCase().includes(q) || r.id.includes(q)) : rows;
    const col = sortCol;
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (col === "Project") cmp = a.projectName.localeCompare(b.projectName);
      else if (col === "Status") cmp = a.status.localeCompare(b.status);
      else if (col === "Started") cmp = Date.parse(a.startedAt) - Date.parse(b.startedAt);
      else if (col === "Duration") cmp = a.durationMs - b.durationMs;
      else if (col === "Agents") cmp = ((a as any)._agents ?? 0) - ((b as any)._agents ?? 0);
      else if (col === "Tools") cmp = a.toolCalls - b.toolCalls;
      else if (col === "Failed") cmp = a.failedCalls - b.failedCalls;
      else if (col === "Tokens") cmp = a.tokens - b.tokens;
      else if (col === "Cost") cmp = a.cost - b.cost;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, search, sortCol, sortAsc]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const cols = ["Project", "Status", "Started", "Duration", "Agents", "Tools", "Failed", "Tokens", "Cost"];
  const rightCols = new Set(["Duration", "Agents", "Tools", "Failed", "Tokens", "Cost"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-md)" }}>
      <input
        placeholder="Search sessions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: "8px 12px", background: "var(--dv-bg-card)", border: "1px solid var(--dv-border)", borderRadius: "var(--dv-radius-btn)", color: "var(--dv-text)", fontSize: 13, fontFamily: "var(--dv-font)", maxWidth: 320 }}
      />
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>All Sessions ({filtered.length})</span>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {cols.map((h) => (
                  <th key={h} onClick={() => handleSort(h)} style={{ ...thStyle, textAlign: rightCols.has(h) ? "right" : "left", cursor: "pointer" }}>
                    {h}{sortCol === h ? (sortAsc ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const dot = statusDot(r.status);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                    <td style={cellStyle}>{r.projectName}</td>
                    <td style={cellStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot.color, display: "inline-block" }} />
                        {dot.label}
                      </span>
                    </td>
                    <td style={cellStyle}>{relativeTime(r.startedAt)}</td>
                    <td style={cellStyleRight}>{fmtDuration(r.durationMs)}</td>
                    <td style={cellStyleRight}>{(r as any)._agents ?? 0}</td>
                    <td style={cellStyleRight}>{r.toolCalls}</td>
                    <td style={{ ...cellStyleRight, color: r.failedCalls > 0 ? "var(--dv-red)" : undefined }}>{r.failedCalls}</td>
                    <td style={cellStyleRight}>{fmtNum(r.tokens)}</td>
                    <td style={{ ...cellStyleRight, color: "var(--dv-amber)" }}>{fmtCost(r.cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No sessions found</div>}
        </div>
      </div>
    </div>
  );
}

// ── Tools Page ─────────────────────────────────────────────────────

interface ToolSummary {
  toolName: string;
  category: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
}

function ToolsPage() {
  const [data, setData] = useState<ToolSummary[]>([]);
  useEffect(() => {
    fetch(`${API}/analytics/tools/summary`).then((r) => r.ok ? r.json() : []).then(setData).catch(() => {});
  }, []);

  const top5 = useMemo(() => data.slice(0, 5), [data]);
  const maxCalls = Math.max(...top5.map((d) => d.totalCalls), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-md)" }}>
      {top5.length > 0 && (
        <div style={chartContainerStyle}>
          <span style={chartTitleStyle}>Top 5 Tools</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {top5.map((t) => (
              <div key={t.toolName} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 100, fontSize: 12, color: "var(--dv-text)", textAlign: "right", flexShrink: 0 }}>{t.toolName}</span>
                <div style={{ flex: 1, height: 20, background: "var(--dv-border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(t.totalCalls / maxCalls) * 100}%`, height: "100%", background: "var(--dv-green)", borderRadius: 4, opacity: 0.85 }} />
                </div>
                <span style={{ width: 50, fontSize: 12, fontFamily: "var(--dv-font-mono)", color: "var(--dv-text-secondary)" }}>{fmtNum(t.totalCalls)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Tool Usage ({data.length} tools)</span>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Tool", "Category", "Calls", "Success", "Failed", "Retries", "Avg Duration", "Max Duration"].map((h) => (
                  <th key={h} style={{ ...thStyle, textAlign: h === "Tool" || h === "Category" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.toolName} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                  <td style={cellStyle}>{t.toolName}</td>
                  <td style={{ ...cellStyle, color: "var(--dv-text-secondary)" }}>{t.category}</td>
                  <td style={cellStyleRight}>{fmtNum(t.totalCalls)}</td>
                  <td style={{ ...cellStyleRight, color: "var(--dv-green)" }}>{t.successCount}</td>
                  <td style={{ ...cellStyleRight, color: t.failureCount > 0 ? "var(--dv-red)" : undefined }}>{t.failureCount}</td>
                  <td style={cellStyleRight}>{t.retryCount}</td>
                  <td style={cellStyleRight}>{t.avgDurationMs != null ? fmtDuration(Math.round(t.avgDurationMs)) : "-"}</td>
                  <td style={cellStyleRight}>{t.maxDurationMs != null ? fmtDuration(t.maxDurationMs) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No tool data yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── Files Page ─────────────────────────────────────────────────────

function FilesPage() {
  const timeline = useWorkshopStore((s) => s.timeline);
  const fileData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of timeline) {
      const e = t.event;
      const raw = e.raw as Record<string, unknown>;
      const toolInput = raw?.tool_input as Record<string, unknown> | undefined;
      if (e.hookEventName === "PreToolUse" && toolInput) {
        const fp = toolInput.file_path as string | undefined;
        if (fp && (e.toolName === "Edit" || e.toolName === "Write" || e.toolName === "MultiEdit")) {
          counts[fp] = (counts[fp] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([path, count]) => ({ path, count }));
  }, [timeline]);

  return (
    <div style={chartContainerStyle}>
      <span style={chartTitleStyle}>Modified Files ({fileData.length})</span>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }}>File Path</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Times Modified</th>
            </tr>
          </thead>
          <tbody>
            {fileData.map((f) => (
              <tr key={f.path} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                <td style={{ ...cellStyle, fontFamily: "var(--dv-font-mono)", fontSize: 12 }}>{f.path}</td>
                <td style={cellStyleRight}>{f.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fileData.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No file modifications yet</div>}
      </div>
    </div>
  );
}

// ── Git Page ───────────────────────────────────────────────────────

function GitPage() {
  const timeline = useWorkshopStore((s) => s.timeline);
  const derived = useMemo(() => {
    const events = timeline.map((t) => t.event);
    return deriveMetrics(events);
  }, [timeline]);

  const breakdown = useMemo(() => {
    return Object.entries(derived.gitOpsBreakdown).sort((a, b) => b[1] - a[1]).map(([op, count]) => ({ op, count }));
  }, [derived]);

  const mostCommon = breakdown.length > 0 ? breakdown[0].op : "-";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-md)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--dv-space-md)" }}>
        <div style={chartContainerStyle}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "var(--dv-text-secondary)" }}>Total Git Ops</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: "var(--dv-text-heading)" }}>{derived.gitOperations}</span>
        </div>
        <div style={chartContainerStyle}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "var(--dv-text-secondary)" }}>Most Common Op</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: "var(--dv-blue)" }}>{mostCommon}</span>
        </div>
      </div>
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Git Operations Breakdown</span>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Operation</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r) => (
                <tr key={r.op} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                  <td style={{ ...cellStyle, fontFamily: "var(--dv-font-mono)" }}>{r.op}</td>
                  <td style={cellStyleRight}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {breakdown.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No git operations yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── Projects Page ──────────────────────────────────────────────────

function ProjectsPage({
  projects,
  sessions,
}: {
  projects: Record<string, import("@agent-workshop/shared").SerializedProject>;
  sessions: Record<string, import("@agent-workshop/shared").SerializedSession>;
}) {
  const rows = useMemo(() => {
    return Object.values(projects).map((p) => {
      const sessionCount = Object.values(sessions).filter((s) => s.projectId === p.id).length;
      return { id: p.id, name: p.name, sessions: sessionCount, lastActivity: p.lastSeen };
    }).sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
  }, [projects, sessions]);

  return (
    <div style={chartContainerStyle}>
      <span style={chartTitleStyle}>Projects ({rows.length})</span>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }}>Project Name</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Sessions</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                <td style={cellStyle}>{r.name}</td>
                <td style={cellStyleRight}>{r.sessions}</td>
                <td style={cellStyle}>{relativeTime(r.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No projects yet</div>}
      </div>
    </div>
  );
}

// ── Tokens Page ────────────────────────────────────────────────────

function TokensPage({ tokenData }: { tokenData: TokenBucket[] }) {
  const totals = useMemo(() => {
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, apiCalls = 0;
    for (const t of tokenData) {
      input += t.inputTokens ?? 0;
      output += t.outputTokens ?? 0;
      cacheRead += t.cacheReadTokens ?? 0;
      cacheWrite += t.cacheCreationTokens ?? 0;
      apiCalls += t.apiCalls ?? 0;
    }
    const total = input + output + cacheRead + cacheWrite;
    const cacheHit = total > 0 ? Math.round((cacheRead / total) * 100) : 0;
    return { input, output, cacheRead, cacheWrite, total, apiCalls, cacheHit };
  }, [tokenData]);

  const contextLimit = 200_000;
  const contextPct = Math.min(Math.round((totals.total / contextLimit) * 100), 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-md)" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--dv-space-md)" }}>
        <div style={chartContainerStyle}>
          <span className="dv-label" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, color: "var(--dv-text-secondary)" }}>Total Tokens</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--dv-blue)" }}>{fmtNum(totals.total)}</span>
        </div>
        <div style={chartContainerStyle}>
          <span className="dv-label" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, color: "var(--dv-text-secondary)" }}>API Calls</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--dv-text-heading)" }}>{fmtNum(totals.apiCalls)}</span>
        </div>
        <div style={chartContainerStyle}>
          <span className="dv-label" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, color: "var(--dv-text-secondary)" }}>Cache Hit Rate</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--dv-green)" }}>{totals.cacheHit}%</span>
        </div>
        <div style={chartContainerStyle}>
          <span className="dv-label" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, color: "var(--dv-text-secondary)" }}>Context Window</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: contextPct > 80 ? "var(--dv-red)" : "var(--dv-text-heading)" }}>{contextPct}%</span>
            <div style={{ height: 8, background: "var(--dv-border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${contextPct}%`, height: "100%", background: contextPct > 80 ? "var(--dv-red)" : "var(--dv-green)", borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>
      {/* Per-session breakdown */}
      <div style={chartContainerStyle}>
        <span style={chartTitleStyle}>Per-Session Breakdown</span>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Session", "Model", "API Calls", "Input", "Output", "Cache Write", "Cache Read", "Context"].map((h) => (
                  <th key={h} style={{ ...thStyle, textAlign: h === "Session" || h === "Model" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokenData.map((t, i) => {
                const total = (t.inputTokens ?? 0) + (t.outputTokens ?? 0) + (t.cacheReadTokens ?? 0) + (t.cacheCreationTokens ?? 0);
                const pct = Math.min(Math.round((total / contextLimit) * 100), 100);
                return (
                  <tr key={`${t.sessionId}-${i}`} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                    <td style={{ ...cellStyle, fontFamily: "var(--dv-font-mono)", fontSize: 12 }}>{t.sessionId?.slice(0, 8) ?? "-"}</td>
                    <td style={cellStyle}>{t.model ?? "-"}</td>
                    <td style={cellStyleRight}>{t.apiCalls ?? 0}</td>
                    <td style={cellStyleRight}>{fmtNum(t.inputTokens ?? 0)}</td>
                    <td style={cellStyleRight}>{fmtNum(t.outputTokens ?? 0)}</td>
                    <td style={cellStyleRight}>{fmtNum(t.cacheCreationTokens ?? 0)}</td>
                    <td style={cellStyleRight}>{fmtNum(t.cacheReadTokens ?? 0)}</td>
                    <td style={cellStyleRight}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tokenData.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No token data yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── Waste Page ─────────────────────────────────────────────────────

function WastePage({ tokenData }: { tokenData: TokenBucket[] }) {
  const timeline = useWorkshopStore((s) => s.timeline);
  const derived = useMemo(() => deriveMetrics(timeline.map((t) => t.event)), [timeline]);

  const totals = useMemo(() => {
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
    for (const t of tokenData) { input += t.inputTokens ?? 0; output += t.outputTokens ?? 0; cacheRead += t.cacheReadTokens ?? 0; cacheWrite += t.cacheCreationTokens ?? 0; }
    return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
  }, [tokenData]);

  // Estimate repeated reads from timeline
  const repeatedReads = useMemo(() => {
    const reads: Record<string, number> = {};
    for (const t of timeline) {
      const e = t.event;
      if (e.hookEventName === "PreToolUse" && e.toolName === "Read") {
        const raw = e.raw as Record<string, unknown>;
        const fp = (raw?.tool_input as Record<string, unknown>)?.file_path as string | undefined;
        if (fp) reads[fp] = (reads[fp] ?? 0) + 1;
      }
    }
    return Object.values(reads).filter((c) => c > 1).reduce((s, c) => s + c - 1, 0);
  }, [timeline]);

  const contextNearLimit = totals.total > 160_000;
  const wasteRatio = totals.total > 0 ? totals.cacheRead / totals.total : 0;
  const excessCacheTokens = wasteRatio > 0.5 ? Math.round(totals.cacheRead * (wasteRatio - 0.5)) : 0;

  const cardStyle: React.CSSProperties = { ...chartContainerStyle, borderLeft: "3px solid var(--dv-amber)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--dv-space-md)" }}>
      <div style={cardStyle}>
        <span style={{ ...chartTitleStyle, color: "var(--dv-amber)" }}>Failed Tool Calls</span>
        <span style={{ fontSize: 28, fontWeight: 700, color: "var(--dv-amber)" }}>{derived.failedToolCalls}</span>
        <span style={{ fontSize: 13, color: "var(--dv-text-secondary)" }}>
          {derived.failedToolCalls > 0 ? "Review tool error patterns and fix common causes." : "No failures detected."}
        </span>
      </div>
      <div style={cardStyle}>
        <span style={{ ...chartTitleStyle, color: "var(--dv-amber)" }}>Repeated File Reads</span>
        <span style={{ fontSize: 28, fontWeight: 700, color: "var(--dv-amber)" }}>{repeatedReads}</span>
        <span style={{ fontSize: 13, color: "var(--dv-text-secondary)" }}>
          {repeatedReads > 0 ? "Cache file contents to avoid re-reading the same files." : "No excessive re-reads detected."}
        </span>
      </div>
      <div style={cardStyle}>
        <span style={{ ...chartTitleStyle, color: "var(--dv-amber)" }}>Context Near Limit</span>
        <span style={{ fontSize: 28, fontWeight: 700, color: contextNearLimit ? "var(--dv-red)" : "var(--dv-amber)" }}>
          {contextNearLimit ? "Yes" : "No"}
        </span>
        <span style={{ fontSize: 13, color: "var(--dv-text-secondary)" }}>
          {contextNearLimit ? "Split tasks into smaller sub-agents to reduce context size." : "Context usage is within safe limits."}
        </span>
      </div>
      {excessCacheTokens > 0 && (
        <div style={cardStyle}>
          <span style={{ ...chartTitleStyle, color: "var(--dv-amber)" }}>Excess Cache Tokens</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: "var(--dv-amber)" }}>{fmtNum(excessCacheTokens)}</span>
          <span style={{ fontSize: 13, color: "var(--dv-text-secondary)" }}>
            High cache-read ratio suggests redundant context. Consider restructuring prompts.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Permissions Page ───────────────────────────────────────────────

interface PermissionEvent {
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

function PermissionsPage({
  projects,
  sessions,
}: {
  projects: Record<string, import("@agent-workshop/shared").SerializedProject>;
  sessions: Record<string, import("@agent-workshop/shared").SerializedSession>;
}) {
  const [data, setData] = useState<PermissionEvent[]>([]);
  useEffect(() => {
    fetch(`${API}/analytics/permissions`).then((r) => r.ok ? r.json() : []).then(setData).catch(() => {});
  }, []);

  const decisionColor = (d: string) => {
    if (d === "approved" || d === "allow") return "var(--dv-green)";
    if (d === "denied" || d === "deny") return "var(--dv-red)";
    return "var(--dv-text-secondary)";
  };

  return (
    <div style={chartContainerStyle}>
      <span style={chartTitleStyle}>Permission History ({data.length})</span>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Time", "Project", "Agent", "Tool", "Decision", "Wait Time", "Source"].map((h) => (
                <th key={h} style={{ ...thStyle, textAlign: h === "Wait Time" ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const sess = sessions[r.sessionId];
              const proj = sess ? projects[sess.projectId] : undefined;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--dv-border)" }}>
                  <td style={cellStyle}>{relativeTime(r.requestedAt)}</td>
                  <td style={cellStyle}>{proj?.name ?? "-"}</td>
                  <td style={{ ...cellStyle, fontFamily: "var(--dv-font-mono)", fontSize: 12 }}>{r.agentId.slice(0, 8)}</td>
                  <td style={cellStyle}>{r.toolName ?? "-"}</td>
                  <td style={{ ...cellStyle, color: decisionColor(r.decision), fontWeight: 600 }}>{r.decision}</td>
                  <td style={cellStyleRight}>{r.waitingDurationMs != null ? fmtDuration(r.waitingDurationMs) : "-"}</td>
                  <td style={cellStyle}>{r.requestType ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 && <div style={{ padding: 24, color: "var(--dv-text-secondary)", textAlign: "center" }}>No permission events yet</div>}
      </div>
    </div>
  );
}

// ── Shared table header style ──────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--dv-text-secondary)",
  borderBottom: "1px solid var(--dv-border)",
};

// ── Main DataView ───────────────────────────────────────────────────

export function DataView() {
  const [page, setPage] = useState<SidebarPage>(readPageParam);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const sessions = useWorkshopStore((s) => s.sessions);
  const projects = useWorkshopStore((s) => s.projects);
  const pendingPermissions = useWorkshopStore((s) => s.pendingPermissions);

  // Token data fetched from API
  const [tokenData, setTokenData] = useState<TokenBucket[]>([]);
  const lastFetchRef = useRef(0);

  // Throttled token fetch
  const fetchTokens = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < THROTTLE_MS) return;
    lastFetchRef.current = now;
    try {
      const res = await fetch(`${API}/analytics/tokens`);
      if (res.ok) {
        const data = await res.json();
        setTokenData(data);
      }
    } catch {
      // offline — keep stale data
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, THROTTLE_MS);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Sync page to URL
  const handlePageChange = useCallback((p: SidebarPage) => {
    setPage(p);
    writePageParam(p);
  }, []);

  // Filter sessions by project
  const filteredSessions = useMemo(() => {
    if (projectFilter === "all") return sessions;
    const filtered: Record<string, typeof sessions[string]> = {};
    for (const [id, s] of Object.entries(sessions)) {
      if (s.projectId === projectFilter) filtered[id] = s;
    }
    return filtered;
  }, [sessions, projectFilter]);

  // Project list for filter dropdown
  const projectList = useMemo(() => Object.values(projects), [projects]);

  const pageInfo: Record<SidebarPage, { title: string; subtitle: string }> = {
    overview: { title: "Overview", subtitle: "Real-time agent activity dashboard" },
    sessions: { title: "Sessions", subtitle: "Session history and details" },
    tools: { title: "Tools", subtitle: "Tool usage breakdown" },
    files: { title: "Files", subtitle: "Modified files across sessions" },
    git: { title: "Git", subtitle: "Git operations summary" },
    projects: { title: "Projects", subtitle: "Project-level analytics" },
    tokens: { title: "Tokens", subtitle: "Token consumption details" },
    waste: { title: "Waste", subtitle: "Wasted token analysis" },
    permissions: { title: "Permissions", subtitle: "Permission request log" },
  };

  const info = pageInfo[page];

  return (
    <div
      className="data-view"
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        fontFamily: "var(--dv-font)",
      }}
    >
      {/* ── Sidebar ── */}
      <nav
        style={{
          width: 220,
          minWidth: 220,
          background: "var(--dv-bg-sidebar)",
          borderRight: "1px solid var(--dv-border)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--dv-space-lg) 0",
          gap: 2,
          overflowY: "auto",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--dv-text-heading)",
            padding: "0 var(--dv-space-md) var(--dv-space-md)",
            letterSpacing: "0.02em",
          }}
        >
          Data
        </span>
        {SIDEBAR_ITEMS.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handlePageChange(item.key)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px var(--dv-space-md)",
                margin: "0 8px",
                maxWidth: "calc(100% - 16px)",
                background: active ? "var(--dv-green-bg)" : "transparent",
                color: active ? "var(--dv-green)" : "var(--dv-text-secondary)",
                border: "none",
                borderRadius: "var(--dv-radius-btn)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: "var(--dv-font)",
                cursor: "pointer",
                transition: prefersReducedMotion ? "none" : "background 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ── Main area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--dv-space-md) var(--dv-space-lg)",
            background: "var(--dv-bg-topbar)",
            borderBottom: "1px solid var(--dv-border)",
            minHeight: "var(--dv-topbar-h)",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--dv-text-heading)",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {info.title}
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--dv-text-secondary)",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              {info.subtitle}
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Project dropdown */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                background: "var(--dv-bg-card)",
                color: "var(--dv-text)",
                border: "1px solid var(--dv-border)",
                borderRadius: "var(--dv-radius-btn)",
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "var(--dv-font)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Projects</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Time range buttons */}
            <div
              style={{
                display: "flex",
                border: "1px solid var(--dv-border)",
                borderRadius: "var(--dv-radius-btn)",
                overflow: "hidden",
              }}
            >
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr}
                  onClick={() => setTimeRange(tr)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: timeRange === tr ? 600 : 400,
                    fontFamily: "var(--dv-font)",
                    border: "none",
                    background: timeRange === tr ? "var(--dv-green-bg)" : "var(--dv-bg-card)",
                    color: timeRange === tr ? "var(--dv-green)" : "var(--dv-text-secondary)",
                    cursor: "pointer",
                    borderRight: "1px solid var(--dv-border)",
                    transition: prefersReducedMotion ? "none" : "background 150ms",
                  }}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--dv-space-lg)",
          }}
        >
          {page === "overview" && (
            <OverviewPage
              sessions={filteredSessions}
              projects={projects}
              tokenData={tokenData}
              pendingPermissions={pendingPermissions}
              timeRange={timeRange}
            />
          )}
          {page === "sessions" && (
            <SessionsPage sessions={filteredSessions} projects={projects} tokenData={tokenData} />
          )}
          {page === "tools" && <ToolsPage />}
          {page === "files" && <FilesPage />}
          {page === "git" && <GitPage />}
          {page === "projects" && <ProjectsPage projects={projects} sessions={filteredSessions} />}
          {page === "tokens" && <TokensPage tokenData={tokenData} />}
          {page === "waste" && <WastePage tokenData={tokenData} />}
          {page === "permissions" && <PermissionsPage projects={projects} sessions={filteredSessions} />}
        </main>
      </div>
    </div>
  );
}
