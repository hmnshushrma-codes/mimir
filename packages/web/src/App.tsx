import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkshopStore } from "./store/useWorkshopStore.js";
import { connectDataSource } from "./data/connect.js";
import { ConnectionBadge } from "./components/ConnectionBadge.js";
import { SplashScreen } from "./components/SplashScreen.js";
import { DebugView } from "./views/DebugView.js";
import { WorkshopView } from "./views/WorkshopView.js";

type Tab = "workshop" | "debug";

const BASE_TITLE = "Mimir";

export function App() {
  const [tab, setTab] = useState<Tab>("workshop");
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);
  const status = useWorkshopStore((s) => s.status);
  const sessionsById = useWorkshopStore((s) => s.sessions);
  // Object.values(sessionsById) inside the selector itself would return a
  // new array every call, which trips React's "getSnapshot should be
  // cached" infinite-loop guard. Derive it here instead, memoized on the
  // (stable-until-mutated) sessionsById reference.
  const sessions = useMemo(() => Object.values(sessionsById), [sessionsById]);

  const waitingForPermissionCount = useMemo(
    () => sessions.reduce((count, session) => count + session.agents.filter((a) => a.state.lifecycle === "waiting_permission").length, 0),
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
          <button className={`tab-button ${tab === "debug" ? "active" : ""}`} onClick={() => setTab("debug")}>
            Debug
          </button>
        </nav>
        <span className="spacer" />
        <ConnectionBadge status={status} />
      </header>

      <main className="main-content">{tab === "workshop" ? <WorkshopView /> : <DebugView />}</main>
    </div>
  );
}
