/**
 * Split-mode KPI strip + live activity ticker.
 * Shows below the workshop in Split view.
 * Updates max 1/sec via throttle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { deriveMetrics } from "@agent-workshop/shared";
import { useWorkshopStore } from "../store/useWorkshopStore.js";

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

    // Count-up animation
    const duration = 400;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(prev + (next - prev) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <>{prefix}{typeof display === "number" ? display.toLocaleString() : display}{suffix}</>;
}

// ── KPI card ────────────────────────────────────────────────

function KPI({ value, label, prefix, suffix, empty }: {
  value: number | string;
  label: string;
  prefix?: string;
  suffix?: string;
  empty?: boolean;
}) {
  return (
    <div className="split-kpi">
      <span className="split-kpi-value">
        {empty ? <span className="split-kpi-empty">—</span> : <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />}
      </span>
      <span className="split-kpi-label">{label}</span>
    </div>
  );
}

// ── Activity ticker ─────────────────────────────────────────

function useLiveTicker(): string[] {
  const timeline = useWorkshopStore((s) => s.timeline);
  return useMemo(() => {
    const items: string[] = [];
    const recent = timeline.slice(-20).reverse();
    for (const entry of recent) {
      const e = entry.event;
      if (e.hookEventName === "PreToolUse" && e.toolName) {
        const target = e.target ? ` ${e.target.split("/").pop()?.slice(0, 30) ?? ""}` : "";
        items.push(`${e.toolName}${target}`);
      }
      if (items.length >= 5) break;
    }
    return items.length > 0 ? items : ["Waiting for activity..."];
  }, [timeline]);
}

// ── Main component ──────────────────────────────────────────

export function SplitStrip() {
  const timeline = useWorkshopStore((s) => s.timeline);
  const sessions = useWorkshopStore((s) => s.sessions);
  const pendingPerms = useWorkshopStore((s) => s.pendingPermissions);

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
    () => sessionList.reduce((n, s) => n + s.agents.filter((a) => a.displayState === "working" || a.displayState === "thinking").length, 0),
    [sessionList]
  );

  const hasData = events.length > 0;

  return (
    <div className="split-strip">
      <div className="split-strip-cards">
        <KPI value={activeAgents} label="Agents" empty={!hasData} />
        <KPI value={metrics.totalToolCalls} label="Tools" empty={!hasData} />
        <KPI value={metrics.linesAdded} label="Lines +" prefix="+" empty={!hasData} />
        <KPI value={metrics.filesModified} label="Files" empty={!hasData} />
        <KPI value={metrics.successRate} label="Success" suffix="%" empty={!hasData} />
        <KPI value={metrics.gitOperations} label="Git Ops" empty={!hasData} />
      </div>
      <div className="split-ticker">
        {tickerItems.map((item, i) => (
          <span key={i} className="split-ticker-item">{item}</span>
        ))}
      </div>
    </div>
  );
}
