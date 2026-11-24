/**
 * Core work types — the shared vocabulary for Mimir Work.
 * Every adapter, store and report uses these types.
 *
 * Feature flag: AGENT_WORKSHOP_WORK=true
 */

// ── Source kinds ────────────────────────────────────────────

export type SourceKind = "github" | "jira" | "bitbucket" | "manual" | "vercel";

// ── Status buckets ─────────────────────────────────────────

export type StatusBucket = "todo" | "in_progress" | "in_review" | "done" | "blocked";

// ── Work items ─────────────────────────────────────────────

export interface WorkItem {
  id: string;
  connectionId: string;
  sourceKind: SourceKind;
  /** External key (e.g. "PROJ-123", "123", "acme/web#45") */
  externalKey: string;
  /** External URL to the issue/ticket */
  externalUrl: string | null;
  title: string;
  status: StatusBucket;
  /** Raw status string from the source */
  rawStatus: string;
  labels: string[];
  assignee: string | null;
  /** Story points or size estimate */
  points: number | null;
  /** Sprint this item belongs to */
  sprintId: string | null;
  /** Repository or project name */
  repository: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface WorkItemEvent {
  id: string;
  workItemId: string;
  fromBucket: StatusBucket | null;
  toBucket: StatusBucket;
  timestamp: string;
  /** What triggered this event */
  source: "sync" | "manual";
}

// ── Sprints ────────────────────────────────────────────────

export interface Sprint {
  id: string;
  connectionId: string;
  name: string;
  state: "active" | "closed" | "future";
  startDate: string | null;
  endDate: string | null;
}

// ── Pull requests ──────────────────────────────────────────

export interface PullRequest {
  id: string;
  connectionId: string;
  sourceKind: SourceKind;
  externalKey: string;
  externalUrl: string | null;
  title: string;
  state: "open" | "closed" | "merged" | "draft";
  repository: string;
  branch: string | null;
  /** Linked work item IDs */
  workItemIds: string[];
  author: string | null;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

// ── Connections ────────────────────────────────────────────

export interface Connection {
  id: string;
  sourceKind: SourceKind;
  name: string;
  /** Reference to credentials — never the token itself */
  credentialRef: string;
  /** Filter: repos, projects, boards, etc. */
  scope: Record<string, unknown>;
  /** Last successful sync */
  lastSyncAt: string | null;
  /** Sync state */
  syncState: "idle" | "syncing" | "rate_limited" | "auth_failed" | "error";
  syncError: string | null;
  createdAt: string;
}

// ── Status mapping ─────────────────────────────────────────

/**
 * Maps a raw status string from any source to a StatusBucket.
 * Pure function, no I/O. Unknown statuses fall back to "todo" and never throw.
 *
 * @param source - The source kind
 * @param rawStatus - The raw status string from the source
 * @param rawCategory - Optional Jira status category
 */
export function mapStatus(source: SourceKind, rawStatus: string, rawCategory?: string): StatusBucket {
  const s = rawStatus.trim().toLowerCase();

  // ── Jira status categories (most reliable) ──
  if (source === "jira" && rawCategory) {
    const cat = rawCategory.trim().toLowerCase();
    switch (cat) {
      case "new":
      case "undefined": return "todo";
      case "indeterminate": return "in_progress";
      case "done": return "done";
    }
  }

  // ── GitHub issues ──
  if (source === "github") {
    if (s === "open") return "todo";
    if (s === "closed") return "done";
    // GitHub Projects v2 status field names
    if (s === "todo" || s === "backlog" || s === "triage" || s === "new") return "todo";
    if (s === "in progress" || s === "in_progress" || s === "working" || s === "active") return "in_progress";
    if (s === "in review" || s === "in_review" || s === "review" || s === "awaiting review") return "in_review";
    if (s === "done" || s === "completed" || s === "closed" || s === "shipped" || s === "merged") return "done";
    if (s === "blocked" || s === "on hold" || s === "paused") return "blocked";
  }

  // ── Jira statuses (without category) ──
  if (source === "jira") {
    if (s === "to do" || s === "open" || s === "backlog" || s === "new" || s === "created") return "todo";
    if (s === "in progress" || s === "in development" || s === "development" || s === "active" || s === "started") return "in_progress";
    if (s === "in review" || s === "code review" || s === "review" || s === "awaiting review" || s === "in qa" || s === "testing") return "in_review";
    if (s === "done" || s === "closed" || s === "resolved" || s === "completed" || s === "released") return "done";
    if (s === "blocked" || s === "on hold" || s === "impediment") return "blocked";
  }

  // ── Bitbucket ──
  if (source === "bitbucket") {
    if (s === "new" || s === "open") return "todo";
    if (s === "resolved" || s === "closed") return "done";
  }

  // ── Vercel (deployment states) ──
  if (source === "vercel") {
    if (s === "queued" || s === "building" || s === "initializing") return "in_progress";
    if (s === "ready" || s === "succeeded") return "done";
    if (s === "error" || s === "canceled" || s === "cancelled") return "blocked";
  }

  // ── Generic fallbacks (any source) ──
  if (s === "todo" || s === "open" || s === "new" || s === "backlog") return "todo";
  if (s === "in progress" || s === "in_progress" || s === "active" || s === "started" || s === "working") return "in_progress";
  if (s === "in review" || s === "in_review" || s === "review") return "in_review";
  if (s === "done" || s === "closed" || s === "resolved" || s === "completed") return "done";
  if (s === "blocked" || s === "on hold") return "blocked";

  // Unknown → todo (never throw)
  return "todo";
}
