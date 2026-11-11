import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkshopStore } from "./store/useWorkshopStore.js";
import { connectDataSource } from "./data/connect.js";
import { ConnectionBadge } from "./components/ConnectionBadge.js";
import { SplashScreen } from "./components/SplashScreen.js";
import { DebugView } from "./views/DebugView.js";
import { WorkshopView } from "./views/WorkshopView.js";
import { DashboardView } from "./views/DashboardView.js";
import { AnalyticsView } from "./views/AnalyticsView.js";
import { DemoControlBar } from "./components/DemoControlBar.js";
import { isDemoMode, triggerDemoEvent } from "./data/demoSource.js";

const API_BASE = window.location.origin;

type Tab = "workshop" | "dashboard" | "analytics" | "debug";

const BASE_TITLE = "Mimir";

export function App() {
  const [tab, setTab] = useState<Tab>("workshop");
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);
  const status = useWorkshopStore((s) => s.status);
  const sessionsById = useWorkshopStore((s) => s.sessions);
  const setProjectFilter = useWorkshopStore((s) => s.setProjectFilter);
  const setFocusedSession = useWorkshopStore((s) => s.setFocusedSession);
  const debugOverlayEnabled = useWorkshopStore((s) => s.debugOverlayEnabled);
  const toggleDebugOverlay = useWorkshopStore((s) => s.toggleDebugOverlay);
  const openProjectInWorkshop = useCallback(
    (projectId: string) => {
      setProjectFilter(projectId);
      setTab("workshop");
    },
    [setProjectFilter]
  );
  const openSessionInWorkshop = useCallback(
    (sessionId: string) => {
      setFocusedSession(sessionId);
      setTab("workshop");
    },
    [setFocusedSession]
  );
  // Object.values(sessionsById) inside the selector itself would return a
  // new array every call, which trips React's "getSnapshot should be
  // cached" infinite-loop guard. Derive it here instead, memoized on the
  // (stable-until-mutated) sessionsById reference.
  const sessions = useMemo(() => Object.values(sessionsById), [sessionsById]);

  const waitingForPermissionCount = useMemo(
    () => sessions.reduce((count, session) => count + session.agents.filter((a) => a.displayState === "needs_permission").length, 0),
    [sessions]
  );

  useEffect(() => connectDataSource(), []);

  useEffect(() => {
    document.title = waitingForPermissionCount > 0 ? `(${waitingForPermissionCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [waitingForPermissionCount]);

  return (
    <div className="app">
      {showSplash && <SplashScreen onComplete={hideSplash} />}
      <header className="app-header">
        <span className="app-title">Mimir</span>
        <nav className="tabs">
          <button className={`tab-button ${tab === "workshop" ? "active" : ""}`} onClick={() => setTab("workshop")}>
            Workshop
          </button>
          <button className={`tab-button ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={`tab-button ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>
            Analytics
          </button>
          <button className={`tab-button ${tab === "debug" ? "active" : ""}`} onClick={() => setTab("debug")}>
            Debug
          </button>
        </nav>
        <span className="spacer" />
        <a className="docs-link" href="/docs.html" target="_blank" rel="noopener">
          Docs
        </a>
        {!isDemoMode() && (
          <>
            <label className="debug-overlay-toggle">
              <input type="checkbox" checked={debugOverlayEnabled} onChange={toggleDebugOverlay} />
              State labels
            </label>
            <button
              className="clear-history-btn"
              onClick={async () => {
                if (!confirm("Clear all old sessions? Active sessions will be kept.")) return;
                try {
                  const res = await fetch(`${API_BASE}/history`, { method: "DELETE" });
                  if (!res.ok) throw new Error(await res.text());
                } catch (e) {
                  console.error("Failed to clear history", e);
                }
              }}
              title="Clear old sessions from database"
            >
              Clear history
            </button>
            <ConnectionBadge status={status} />
          </>
        )}
      </header>

      {isDemoMode() && <DemoControlBar onTrigger={triggerDemoEvent} />}

      <main className="main-content">
        {tab === "workshop" && <WorkshopView />}
        {tab === "dashboard" && <DashboardView onOpenProject={openProjectInWorkshop} onOpenSession={openSessionInWorkshop} />}
        {tab === "analytics" && <AnalyticsView />}
        {tab === "debug" && <DebugView />}
      </main>
    </div>
  );
}
