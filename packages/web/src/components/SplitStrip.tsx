/**
 * Split-mode KPI strip + live activity ticker.
 * Dark themed to match the Data view. Sits below the workshop.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { deriveMetrics } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";
import "../styles/data-theme.css";

// ── Animated number ─────────────────────────────────────────

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = typeof prevRef.current === "number" ? prevRef.current : 0;
    const next = typeof value === "number" ? value : 0;
    prevRef.current = value;

    if (typeof value !== "number" || prev === next) {
      setDisplay(value);
      return;
    }

    const duration = 400;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(prev + (next - prev) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <>{prefix}{typeof display === "number" ? display.toLocaleString() : display}{suffix}</>;
}

// ── KPI card ────────────────────────────────────────────────

function KPI({ value, label, prefix, suffix, empty, color }: {
  value: number | string;
  label: string;
  prefix?: string;
  suffix?: string;
  empty?: boolean;
  color?: string;
}) {
  return (
    <div style={{
      background: "var(--dv-bg-card, #1A1F28)",
      border: "1px solid var(--dv-border, #2A303B)",
      borderRadius: 12,
      padding: "14px 8px",
      textAlign: "center",
      flex: 1,
      minWidth: 90,
    }}>
      <div style={{
        fontSize: 32,
        fontWeight: 800,
        color: color ?? "var(--dv-text-heading, #fff)",
        lineHeight: 1.1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {empty ? <span style={{ opacity: 0.3 }}>—</span> : <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />}
      </div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--dv-text-secondary, #A3ACBA)",
        marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Clean activity ticker ───────────────────────────────────

const VERB_MAP: Record<string, string> = {
  Read: "Reading", Edit: "Editing", Write: "Writing",
  Bash: "Running", Grep: "Searching", Glob: "Finding",
  Agent: "Delegating", WebFetch: "Fetching", WebSearch: "Searching web",
};

function useLiveTicker(): string[] {
  const timeline = useWorkshopStore((s) => s.timeline);
  return useMemo(() => {
    const items: string[] = [];
    const recent = timeline.slice(-30).reverse();
    for (const entry of recent) {
      const e = entry.event;
      if (e.hookEventName === "PreToolUse" && e.toolName) {
        const verb = VERB_MAP[e.toolName] ?? e.toolName;
        const file = e.target?.split("/").pop()?.slice(0, 25);
        items.push(file ? `${verb} ${file}` : verb);
      }
      if (items.length >= 6) break;
    }
    return items.length > 0 ? items : ["Waiting for activity..."];
  }, [timeline]);
}

// ── Main component ──────────────────────────────────────────

export function SplitStrip() {
  const timeline = useWorkshopStore((s) => s.timeline);
  const sessions = useWorkshopStore((s) => s.sessions);

  // Throttle: compute metrics at most 1/sec
  const [throttledEvents, setThrottledEvents] = useState(timeline);
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) return;
    lastUpdateRef.current = now;
    setThrottledEvents(timeline);
  }, [timeline]);

  const events = useMemo(() => throttledEvents.map((e) => e.event), [throttledEvents]);
  const metrics = useMemo(() => deriveMetrics(events), [events]);
  const tickerItems = useLiveTicker();

  const sessionList = useMemo(() => Object.values(sessions), [sessions]);
  const activeAgents = useMemo(
    () => sessionList.reduce((n, s) => n + s.agents.filter((a) =>
      a.displayState === "working" || a.displayState === "thinking"
    ).length, 0),
    [sessionList]
  );

  const hasData = events.length > 0;

  return (
    <div style={{
      background: "var(--dv-bg-app, #12151B)",
      padding: "16px 20px 12px",
      fontFamily: "var(--dv-font, 'Inter', system-ui, sans-serif)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      height: "100%",
      justifyContent: "center",
    }}>
      {/* KPI cards row */}
      <div style={{ display: "flex", gap: 10 }}>
        <KPI value={activeAgents} label="Agents" empty={!hasData} />
        <KPI value={metrics.totalToolCalls} label="Tool Calls" empty={!hasData} />
        <KPI value={metrics.linesAdded} label="Lines +" prefix="+" empty={!hasData} color="var(--dv-green, #3DDC97)" />
        <KPI value={metrics.filesModified} label="Files" empty={!hasData} />
        <KPI value={metrics.successRate} label="Success" suffix="%" empty={!hasData} color="var(--dv-green, #3DDC97)" />
        <KPI value={metrics.gitOperations} label="Git Ops" empty={!hasData} />
      </div>

      {/* Activity ticker */}
      <div style={{
        display: "flex",
        gap: 20,
        fontSize: 12,
        color: "var(--dv-text-secondary, #A3ACBA)",
        overflow: "hidden",
        borderTop: "1px solid var(--dv-border, #2A303B)",
        paddingTop: 8,
      }}>
        {tickerItems.map((item, i) => (
          <span key={i} style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--dv-green, #3DDC97)" }}>&#9656;</span> {item}
          </span>
        ))}
      </div>
    </div>
  );
}
