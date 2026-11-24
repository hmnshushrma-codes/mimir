/**
 * SQLite implementation of WorkStore.
 * Uses node:sqlite (Node >= 22.13). Additive migrations only.
 * Tokens are NEVER stored here.
 */

import type { DatabaseSync } from "node:sqlite";
import type { WorkItem, WorkItemEvent, Sprint, PullRequest, Connection } from "@agent-workshop/shared";
import type { WorkStore, SessionLink, ReportSnapshot } from "@agent-workshop/shared";

export function createWorkTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_connections (
      id TEXT PRIMARY KEY,
      source_kind TEXT NOT NULL,
      name TEXT NOT NULL,
      credential_ref TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '{}',
      last_sync_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'idle',
      sync_error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      external_key TEXT NOT NULL,
      external_url TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      raw_status TEXT NOT NULL,
      labels TEXT NOT NULL DEFAULT '[]',
      assignee TEXT,
      points REAL,
      sprint_id TEXT,
      repository TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS work_item_events (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      from_bucket TEXT,
      to_bucket TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'sync'
    );

    CREATE TABLE IF NOT EXISTS work_sprints (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS work_pull_requests (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      external_key TEXT NOT NULL,
      external_url TEXT,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      repository TEXT NOT NULL,
      branch TEXT,
      work_item_ids TEXT NOT NULL DEFAULT '[]',
      author TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      merged_at TEXT,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS work_session_links (
      session_id TEXT NOT NULL,
      work_item_id TEXT NOT NULL,
      match_method TEXT NOT NULL,
      linked_at TEXT NOT NULL,
      PRIMARY KEY (session_id, work_item_id)
    );

    CREATE TABLE IF NOT EXISTS work_report_snapshots (
      id TEXT PRIMARY KEY,
      period TEXT NOT NULL,
      anchor TEXT NOT NULL,
      connection_id TEXT,
      data TEXT NOT NULL,
      computed_at TEXT NOT NULL
    );
  `);
}

export class SqliteWorkStore implements WorkStore {
  constructor(private db: DatabaseSync) {
    createWorkTables(db);
  }

  // ── Items ──

  upsertItem(item: WorkItem): void {
    this.db.exec(`INSERT INTO work_items (id, connection_id, source_kind, external_key, external_url, title, status, raw_status, labels, assignee, points, sprint_id, repository, created_at, updated_at, closed_at)
      VALUES ('${item.id}', '${item.connectionId}', '${item.sourceKind}', '${item.externalKey}', ${item.externalUrl ? `'${item.externalUrl}'` : "NULL"}, '${item.title.replace(/'/g, "''")}', '${item.status}', '${item.rawStatus.replace(/'/g, "''")}', '${JSON.stringify(item.labels)}', ${item.assignee ? `'${item.assignee.replace(/'/g, "''")}'` : "NULL"}, ${item.points ?? "NULL"}, ${item.sprintId ? `'${item.sprintId}'` : "NULL"}, ${item.repository ? `'${item.repository}'` : "NULL"}, '${item.createdAt}', '${item.updatedAt}', ${item.closedAt ? `'${item.closedAt}'` : "NULL"})
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, status = excluded.status, raw_status = excluded.raw_status,
        labels = excluded.labels, assignee = excluded.assignee, points = excluded.points,
        sprint_id = excluded.sprint_id, repository = excluded.repository,
        updated_at = excluded.updated_at, closed_at = excluded.closed_at`);
  }

  getItem(id: string): WorkItem | null {
    const row = this.db.prepare("SELECT * FROM work_items WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToItem(row) : null;
  }

  listItems(filter?: { connectionId?: string; status?: string; sprintId?: string }): WorkItem[] {
    let sql = "SELECT * FROM work_items WHERE 1=1";
    if (filter?.connectionId) sql += ` AND connection_id = '${filter.connectionId}'`;
    if (filter?.status) sql += ` AND status = '${filter.status}'`;
    if (filter?.sprintId) sql += ` AND sprint_id = '${filter.sprintId}'`;
    return (this.db.prepare(sql).all() as Record<string, unknown>[]).map((r) => this.rowToItem(r));
  }

  private rowToItem(r: Record<string, unknown>): WorkItem {
    return {
      id: r.id as string, connectionId: r.connection_id as string,
      sourceKind: r.source_kind as WorkItem["sourceKind"],
      externalKey: r.external_key as string, externalUrl: r.external_url as string | null,
      title: r.title as string, status: r.status as WorkItem["status"],
      rawStatus: r.raw_status as string,
      labels: JSON.parse((r.labels as string) || "[]"),
      assignee: r.assignee as string | null, points: r.points as number | null,
      sprintId: r.sprint_id as string | null, repository: r.repository as string | null,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      closedAt: r.closed_at as string | null,
    };
  }

  // ── Events ──

  insertEvent(event: WorkItemEvent): void {
    this.db.exec(`INSERT OR IGNORE INTO work_item_events (id, work_item_id, from_bucket, to_bucket, timestamp, source)
      VALUES ('${event.id}', '${event.workItemId}', ${event.fromBucket ? `'${event.fromBucket}'` : "NULL"}, '${event.toBucket}', '${event.timestamp}', '${event.source}')`);
  }

  listEvents(workItemId: string): WorkItemEvent[] {
    return (this.db.prepare("SELECT * FROM work_item_events WHERE work_item_id = ? ORDER BY timestamp").all(workItemId) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, workItemId: r.work_item_id as string,
      fromBucket: r.from_bucket as WorkItemEvent["fromBucket"],
      toBucket: r.to_bucket as WorkItemEvent["toBucket"],
      timestamp: r.timestamp as string, source: r.source as "sync" | "manual",
    }));
  }

  listEventsSince(since: string): WorkItemEvent[] {
    return (this.db.prepare("SELECT * FROM work_item_events WHERE timestamp >= ? ORDER BY timestamp").all(since) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, workItemId: r.work_item_id as string,
      fromBucket: r.from_bucket as WorkItemEvent["fromBucket"],
      toBucket: r.to_bucket as WorkItemEvent["toBucket"],
      timestamp: r.timestamp as string, source: r.source as "sync" | "manual",
    }));
  }

  // ── Sprints ──

  upsertSprint(sprint: Sprint): void {
    this.db.exec(`INSERT INTO work_sprints (id, connection_id, name, state, start_date, end_date)
      VALUES ('${sprint.id}', '${sprint.connectionId}', '${sprint.name.replace(/'/g, "''")}', '${sprint.state}', ${sprint.startDate ? `'${sprint.startDate}'` : "NULL"}, ${sprint.endDate ? `'${sprint.endDate}'` : "NULL"})
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, state = excluded.state, start_date = excluded.start_date, end_date = excluded.end_date`);
  }

  listSprints(connectionId: string): Sprint[] {
    return (this.db.prepare("SELECT * FROM work_sprints WHERE connection_id = ?").all(connectionId) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, connectionId: r.connection_id as string,
      name: r.name as string, state: r.state as Sprint["state"],
      startDate: r.start_date as string | null, endDate: r.end_date as string | null,
    }));
  }

  // ── Pull requests ──

  upsertPR(pr: PullRequest): void {
    this.db.exec(`INSERT INTO work_pull_requests (id, connection_id, source_kind, external_key, external_url, title, state, repository, branch, work_item_ids, author, created_at, updated_at, merged_at, closed_at)
      VALUES ('${pr.id}', '${pr.connectionId}', '${pr.sourceKind}', '${pr.externalKey}', ${pr.externalUrl ? `'${pr.externalUrl}'` : "NULL"}, '${pr.title.replace(/'/g, "''")}', '${pr.state}', '${pr.repository}', ${pr.branch ? `'${pr.branch}'` : "NULL"}, '${JSON.stringify(pr.workItemIds)}', ${pr.author ? `'${pr.author.replace(/'/g, "''")}'` : "NULL"}, '${pr.createdAt}', '${pr.updatedAt}', ${pr.mergedAt ? `'${pr.mergedAt}'` : "NULL"}, ${pr.closedAt ? `'${pr.closedAt}'` : "NULL"})
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, state = excluded.state, updated_at = excluded.updated_at, merged_at = excluded.merged_at, closed_at = excluded.closed_at`);
  }

  listPRs(filter?: { connectionId?: string; state?: string }): PullRequest[] {
    let sql = "SELECT * FROM work_pull_requests WHERE 1=1";
    if (filter?.connectionId) sql += ` AND connection_id = '${filter.connectionId}'`;
    if (filter?.state) sql += ` AND state = '${filter.state}'`;
    return (this.db.prepare(sql).all() as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, connectionId: r.connection_id as string,
      sourceKind: r.source_kind as PullRequest["sourceKind"],
      externalKey: r.external_key as string, externalUrl: r.external_url as string | null,
      title: r.title as string, state: r.state as PullRequest["state"],
      repository: r.repository as string, branch: r.branch as string | null,
      workItemIds: JSON.parse((r.work_item_ids as string) || "[]"),
      author: r.author as string | null,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      mergedAt: r.merged_at as string | null, closedAt: r.closed_at as string | null,
    }));
  }

  // ── Connections ──

  upsertConnection(conn: Connection): void {
    this.db.exec(`INSERT INTO work_connections (id, source_kind, name, credential_ref, scope, last_sync_at, sync_state, sync_error, created_at)
      VALUES ('${conn.id}', '${conn.sourceKind}', '${conn.name.replace(/'/g, "''")}', '${conn.credentialRef}', '${JSON.stringify(conn.scope)}', ${conn.lastSyncAt ? `'${conn.lastSyncAt}'` : "NULL"}, '${conn.syncState}', ${conn.syncError ? `'${conn.syncError.replace(/'/g, "''")}'` : "NULL"}, '${conn.createdAt}')
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, credential_ref = excluded.credential_ref, scope = excluded.scope, last_sync_at = excluded.last_sync_at, sync_state = excluded.sync_state, sync_error = excluded.sync_error`);
  }

  getConnection(id: string): Connection | null {
    const r = this.db.prepare("SELECT * FROM work_connections WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: r.id as string, sourceKind: r.source_kind as Connection["sourceKind"],
      name: r.name as string, credentialRef: r.credential_ref as string,
      scope: JSON.parse((r.scope as string) || "{}"),
      lastSyncAt: r.last_sync_at as string | null,
      syncState: r.sync_state as Connection["syncState"],
      syncError: r.sync_error as string | null,
      createdAt: r.created_at as string,
    };
  }

  listConnections(): Connection[] {
    return (this.db.prepare("SELECT * FROM work_connections").all() as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, sourceKind: r.source_kind as Connection["sourceKind"],
      name: r.name as string, credentialRef: r.credential_ref as string,
      scope: JSON.parse((r.scope as string) || "{}"),
      lastSyncAt: r.last_sync_at as string | null,
      syncState: r.sync_state as Connection["syncState"],
      syncError: r.sync_error as string | null,
      createdAt: r.created_at as string,
    }));
  }

  deleteConnection(id: string): void {
    this.db.exec(`DELETE FROM work_connections WHERE id = '${id}'`);
  }

  // ── Session links ──

  upsertSessionLink(link: SessionLink): void {
    this.db.exec(`INSERT INTO work_session_links (session_id, work_item_id, match_method, linked_at)
      VALUES ('${link.sessionId}', '${link.workItemId}', '${link.matchMethod}', '${link.linkedAt}')
      ON CONFLICT(session_id, work_item_id) DO UPDATE SET match_method = excluded.match_method, linked_at = excluded.linked_at`);
  }

  listSessionLinks(workItemId: string): SessionLink[] {
    return (this.db.prepare("SELECT * FROM work_session_links WHERE work_item_id = ?").all(workItemId) as Record<string, unknown>[]).map((r) => ({
      sessionId: r.session_id as string, workItemId: r.work_item_id as string,
      matchMethod: r.match_method as "branch" | "manual", linkedAt: r.linked_at as string,
    }));
  }

  // ── Report snapshots ──

  upsertReportSnapshot(snap: ReportSnapshot): void {
    this.db.exec(`INSERT INTO work_report_snapshots (id, period, anchor, connection_id, data, computed_at)
      VALUES ('${snap.id}', '${snap.period}', '${snap.anchor}', ${snap.connectionId ? `'${snap.connectionId}'` : "NULL"}, '${snap.data.replace(/'/g, "''")}', '${snap.computedAt}')
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at`);
  }

  getReportSnapshot(period: string, anchor: string, connectionId: string | null): ReportSnapshot | null {
    const sql = connectionId
      ? `SELECT * FROM work_report_snapshots WHERE period = ? AND anchor = ? AND connection_id = ?`
      : `SELECT * FROM work_report_snapshots WHERE period = ? AND anchor = ? AND connection_id IS NULL`;
    const args = connectionId ? [period, anchor, connectionId] : [period, anchor];
    const r = this.db.prepare(sql).get(...args) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: r.id as string, period: r.period as ReportSnapshot["period"],
      anchor: r.anchor as string, connectionId: r.connection_id as string | null,
      data: r.data as string, computedAt: r.computed_at as string,
    };
  }

  // ── Cleanup ──

  deleteAllWorkData(): void {
    this.db.exec(`
      DELETE FROM work_session_links;
      DELETE FROM work_item_events;
      DELETE FROM work_items;
      DELETE FROM work_sprints;
      DELETE FROM work_pull_requests;
      DELETE FROM work_report_snapshots;
      DELETE FROM work_connections;
    `);
  }
}
