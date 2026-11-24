/**
 * WorkStore — storage interface for Mimir Work.
 * The same report engine can run against SQLite (local) or another store (Cloud).
 * Tokens are NEVER stored here (see MW-04 CredentialStore).
 */

import type { WorkItem, WorkItemEvent, Sprint, PullRequest, Connection } from "./types.js";

/** Link between a Claude Code session and a work item */
export interface SessionLink {
  sessionId: string;
  workItemId: string;
  matchMethod: "branch" | "manual";
  linkedAt: string;
}

/** Snapshot of a report for caching */
export interface ReportSnapshot {
  id: string;
  period: "day" | "week" | "month" | "sprint";
  anchor: string; // ISO date
  connectionId: string | null;
  data: string; // JSON-serialized report
  computedAt: string;
}

export interface WorkStore {
  // ── Items ──
  upsertItem(item: WorkItem): void;
  getItem(id: string): WorkItem | null;
  listItems(filter?: { connectionId?: string; status?: string; sprintId?: string }): WorkItem[];

  // ── Events (status transitions) ──
  insertEvent(event: WorkItemEvent): void;
  listEvents(workItemId: string): WorkItemEvent[];
  listEventsSince(since: string): WorkItemEvent[];

  // ── Sprints ──
  upsertSprint(sprint: Sprint): void;
  listSprints(connectionId: string): Sprint[];

  // ── Pull requests ──
  upsertPR(pr: PullRequest): void;
  listPRs(filter?: { connectionId?: string; state?: string }): PullRequest[];

  // ── Connections ──
  upsertConnection(conn: Connection): void;
  getConnection(id: string): Connection | null;
  listConnections(): Connection[];
  deleteConnection(id: string): void;

  // ── Session links ──
  upsertSessionLink(link: SessionLink): void;
  listSessionLinks(workItemId: string): SessionLink[];

  // ── Report snapshots ──
  upsertReportSnapshot(snap: ReportSnapshot): void;
  getReportSnapshot(period: string, anchor: string, connectionId: string | null): ReportSnapshot | null;

  // ── Cleanup ──
  deleteAllWorkData(): void;
}
