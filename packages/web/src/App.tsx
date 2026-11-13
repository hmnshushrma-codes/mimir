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
import { PermissionToastContainer, PermissionBadge } from "./components/PermissionToast.js";
import { isDemoMode, triggerDemoEvent } from "./data/demoSource.js";

const API_BASE = window.location.origin;
const BASE_TITLE = "Mimir";
const VIEW_STORAGE_KEY = "mimir:view:v1";

// ── URL-based routing ──────────────────────────────────────

type ViewMode = "workshop" | "data" | "split" | "debug";

const VALID_VIEWS: ViewMode[] = ["workshop", "data", "split", "debug"];

function readViewFromURL(): ViewMode {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("view");
  if (v && VALID_VIEWS.includes(v as ViewMode)) return v as ViewMode;
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored && VALID_VIEWS.includes(stored as ViewMode)) return stored as ViewMode;
  } catch { /* ignore */ }
  return "workshop";
}

function pushView(view: ViewMode): void {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.pushState({ view }, "", url.toString());
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
}

// ── App ────────────────────────────────────────────────────

export function App() {
  const [view, setViewState] = useState<ViewMode>(readViewFromURL);
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);
  const status = useWorkshopStore((s) => s.status);
  const sessionsById = useWorkshopStore((s) => s.sessions);
  const setProjectFilter = useWorkshopStore((s) => s.setProjectFilter);
  const setFocusedSession = useWorkshopStore((s) => s.setFocusedSession);
  const debugOverlayEnabled = useWorkshopStore((s) => s.debugOverlayEnabled);
  const toggleDebugOverlay = useWorkshopStore((s) => s.toggleDebugOverlay);

  const setView = useCallback((v: ViewMode) => {
    setViewState(v);
    pushView(v);
  }, []);

  // Sync with browser back/forward
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const v = e.state?.view ?? readViewFromURL();
      setViewState(v);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Set initial URL if not present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("view")) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.replaceState({ view }, "", url.toString());
    }
  }, []);

  const openProjectInWorkshop = useCallback(
    (projectId: string) => {
      setProjectFilter(projectId);
      setView("workshop");
    },
    [setProjectFilter, setView]
  );
  const openSessionInWorkshop = useCallback(
    (sessionId: string) => {
      setFocusedSession(sessionId);
      setView("workshop");
    },
    [setFocusedSession, setView]
  );

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

        {/* Segmented view switch */}
        <div className="view-switch">
          <button className={`view-switch-btn ${view === "workshop" ? "active" : ""}`} onClick={() => setView("workshop")}>
            Workshop
          </button>
          <button className={`view-switch-btn ${view === "data" ? "active" : ""}`} onClick={() => setView("data")}>
            Data
          </button>
          <button className={`view-switch-btn ${view === "split" ? "active" : ""}`} onClick={() => setView("split")}>
            Split
          </button>
        </div>

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
            <PermissionBadge />
            <ConnectionBadge status={status} />
          </>
        )}

        {/* Debug tab — small, separate from main view switch */}
        {!isDemoMode() && (
          <button
            className={`tab-button tab-debug ${view === "debug" ? "active" : ""}`}
            onClick={() => setView("debug")}
            title="Debug event feed"
          >
            Debug
          </button>
        )}
      </header>

      {isDemoMode() && <DemoControlBar onTrigger={triggerDemoEvent} />}

      <main className="main-content">
        {view === "workshop" && <WorkshopView />}
        {view === "data" && <AnalyticsView />}
        {view === "split" && (
          <div className="split-view">
            <div className="split-workshop">
              <WorkshopView />
            </div>
            <div className="split-data">
              <SplitStripPlaceholder />
            </div>
          </div>
        )}
        {view === "debug" && <DebugView />}
      </main>

      <PermissionToastContainer />
    </div>
  );
}

/** Placeholder for the split-mode KPI strip — will be replaced with real data */
function SplitStripPlaceholder() {
  return (
    <div className="split-strip">
      <div className="split-strip-cards">
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Agents</span></div>
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Tools</span></div>
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Tokens</span></div>
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Cost</span></div>
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Success</span></div>
        <div className="split-kpi"><span className="split-kpi-value">—</span><span className="split-kpi-label">Perms</span></div>
      </div>
      <div className="split-ticker">
        <span className="split-ticker-item">Waiting for events...</span>
      </div>
    </div>
  );
}
