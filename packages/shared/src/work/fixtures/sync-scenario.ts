/**
 * Fixture: 3-sync scenario for contract tests.
 * Sync 1: 3 items (todo, in_progress, done)
 * Sync 2: item-1 moves to in_progress, item-2 stays (no event), item-4 added
 * Sync 3: item-1 moves to done, item-4 moves to in_review
 */

import type { WorkItem } from "../types.js";

const CONN_ID = "conn-test-1";
const BASE_TIME = "2026-01-15T10:00:00Z";

function item(id: string, title: string, status: "todo" | "in_progress" | "in_review" | "done", updatedAt: string): WorkItem {
  return {
    id,
    connectionId: CONN_ID,
    sourceKind: "github",
    externalKey: `acme/web#${id.replace("item-", "")}`,
    externalUrl: `https://github.com/acme/web/issues/${id.replace("item-", "")}`,
    title,
    status,
    rawStatus: status === "todo" ? "open" : status === "done" ? "closed" : status,
    labels: [],
    assignee: "Ava Dev",
    points: null,
    sprintId: null,
    repository: "acme/web",
    createdAt: BASE_TIME,
    updatedAt,
    closedAt: status === "done" ? updatedAt : null,
  };
}

/** Sync 1: initial state */
export const SYNC_1: WorkItem[] = [
  item("item-1", "Fix login flow", "todo", "2026-01-15T10:00:00Z"),
  item("item-2", "Add dark mode", "in_progress", "2026-01-15T10:00:00Z"),
  item("item-3", "Update README", "done", "2026-01-15T10:00:00Z"),
];

/** Sync 2: item-1 progresses, item-2 unchanged, item-4 new */
export const SYNC_2: WorkItem[] = [
  item("item-1", "Fix login flow", "in_progress", "2026-01-16T10:00:00Z"),
  item("item-2", "Add dark mode", "in_progress", "2026-01-15T10:00:00Z"), // unchanged
  item("item-3", "Update README", "done", "2026-01-15T10:00:00Z"),        // unchanged
  item("item-4", "API rate limiting", "todo", "2026-01-16T10:00:00Z"),     // new
];

/** Sync 3: item-1 done, item-4 in review */
export const SYNC_3: WorkItem[] = [
  item("item-1", "Fix login flow", "done", "2026-01-17T10:00:00Z"),
  item("item-2", "Add dark mode", "in_progress", "2026-01-15T10:00:00Z"),
  item("item-3", "Update README", "done", "2026-01-15T10:00:00Z"),
  item("item-4", "API rate limiting", "in_review", "2026-01-17T10:00:00Z"),
];

export const CONNECTION_ID = CONN_ID;
