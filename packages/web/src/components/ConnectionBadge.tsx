import type { ConnectionStatus } from "../store/useWorkshopStore.js";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  disconnected: "Disconnected",
  demo: "Demo mode"
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>;
}
