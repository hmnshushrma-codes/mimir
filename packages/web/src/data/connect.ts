import { connectDemoSource, isDemoMode } from "./demoSource.js";
import { connectLiveSource } from "./liveSource.js";

export function connectDataSource(): () => void {
  return isDemoMode() ? connectDemoSource() : connectLiveSource();
}
