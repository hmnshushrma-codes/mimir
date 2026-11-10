import { connectDemoSource, isDemoMode } from "./demoSource.js";

/**
 * Connect to the appropriate data source.
 *
 * When VITE_DEMO=true (public deploy), ONLY the demo source is used.
 * The liveSource module (with ws://localhost) is behind a dynamic import
 * that is guarded by a compile-time check, so Vite's dead code elimination
 * ensures no localhost WebSocket code appears in the demo bundle.
 */
export function connectDataSource(): () => void {
  if (isDemoMode()) {
    return connectDemoSource();
  }

  // Live mode — dynamically import to avoid bundling localhost URLs in demo builds
  let cleanup: (() => void) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("./liveSource.js").then((mod) => {
    cleanup = mod.connectLiveSource();
  });
  return () => { cleanup?.(); };
}
