/**
 * Contract test suite for WorkStore implementations.
 * Importable by any package's test files without pulling in vitest at runtime.
 */

import { describe, it, expect } from "vitest";
import type { WorkStore } from "./store.js";
import type { Connection, Sprint, PullRequest } from "./types.js";
import { SYNC_1, SYNC_2, SYNC_3, CONNECTION_ID } from "./fixtures/sync-scenario.js";

export function runStoreContract(factory: () => WorkStore) {
  describe("WorkStore contract", () => {
    let store: WorkStore;

    function freshStore() {
      store = factory();
      const conn: Connection = {
        id: CONNECTION_ID, sourceKind: "github", name: "Test Connection",
        credentialRef: "env:GITHUB_TOKEN", scope: {},
        lastSyncAt: null, syncState: "idle", syncError: null, createdAt: "2026-01-15T09:00:00Z",
      };
      store.upsertConnection(conn);
    }

    describe("items", () => {
      it("upserts items from sync 1", () => {
        freshStore();
        for (const item of SYNC_1) store.upsertItem(item);
        expect(store.listItems()).toHaveLength(3);
      });

      it("upserting same item twice does not duplicate", () => {
        freshStore();
        store.upsertItem(SYNC_1[0]);
        store.upsertItem(SYNC_1[0]);
        expect(store.listItems()).toHaveLength(1);
      });

      it("retrieves item by id", () => {
        freshStore();
        store.upsertItem(SYNC_1[0]);
        const got = store.getItem("item-1");
        expect(got).not.toBeNull();
        expect(got!.title).toBe("Fix login flow");
      });

      it("returns null for missing item", () => {
        freshStore();
        expect(store.getItem("nonexistent")).toBeNull();
      });

      it("filters items by connectionId", () => {
        freshStore();
        for (const item of SYNC_1) store.upsertItem(item);
        expect(store.listItems({ connectionId: CONNECTION_ID })).toHaveLength(3);
        expect(store.listItems({ connectionId: "other" })).toHaveLength(0);
      });
    });

    describe("status events", () => {
      it("records a status event when bucket changes (sync 1 → sync 2)", () => {
        freshStore();
        for (const item of SYNC_1) {
          store.upsertItem(item);
          store.insertEvent({ id: `ev-${item.id}-s1`, workItemId: item.id, fromBucket: null, toBucket: item.status, timestamp: item.updatedAt, source: "sync" });
        }
        for (const item of SYNC_2) {
          const existing = store.getItem(item.id);
          if (!existing || existing.status !== item.status) {
            store.upsertItem(item);
            store.insertEvent({ id: `ev-${item.id}-s2`, workItemId: item.id, fromBucket: existing?.status ?? null, toBucket: item.status, timestamp: item.updatedAt, source: "sync" });
          } else {
            store.upsertItem(item);
          }
        }
        expect(store.listEvents("item-1")).toHaveLength(2);
        expect(store.listEvents("item-2")).toHaveLength(1);
        expect(store.listEvents("item-4")).toHaveLength(1);
      });

      it("full 3-sync scenario produces correct event counts", () => {
        freshStore();
        const syncs = [SYNC_1, SYNC_2, SYNC_3];
        for (let s = 0; s < syncs.length; s++) {
          for (const item of syncs[s]) {
            const existing = store.getItem(item.id);
            const changed = !existing || existing.status !== item.status;
            store.upsertItem(item);
            if (changed) {
              store.insertEvent({ id: `ev-${item.id}-s${s}`, workItemId: item.id, fromBucket: existing?.status ?? null, toBucket: item.status, timestamp: item.updatedAt, source: "sync" });
            }
          }
        }
        expect(store.listEvents("item-1")).toHaveLength(3);
        expect(store.listEvents("item-2")).toHaveLength(1);
        expect(store.listEvents("item-3")).toHaveLength(1);
        expect(store.listEvents("item-4")).toHaveLength(2);
        expect(store.listItems()).toHaveLength(4);
      });
    });

    describe("sprints", () => {
      it("upserts and lists sprints", () => {
        freshStore();
        const sprint: Sprint = { id: "sprint-1", connectionId: CONNECTION_ID, name: "Sprint 1", state: "active", startDate: "2026-01-13", endDate: "2026-01-27" };
        store.upsertSprint(sprint);
        store.upsertSprint(sprint);
        expect(store.listSprints(CONNECTION_ID)).toHaveLength(1);
      });
    });

    describe("pull requests", () => {
      it("upserts and lists PRs", () => {
        freshStore();
        const pr: PullRequest = {
          id: "pr-1", connectionId: CONNECTION_ID, sourceKind: "github",
          externalKey: "acme/web#10", externalUrl: "https://github.com/acme/web/pull/10",
          title: "Fix auth", state: "open", repository: "acme/web",
          branch: "fix/auth", workItemIds: ["item-1"], author: "Ava Dev",
          createdAt: "2026-01-16T10:00:00Z", updatedAt: "2026-01-16T10:00:00Z",
          mergedAt: null, closedAt: null,
        };
        store.upsertPR(pr);
        store.upsertPR(pr);
        expect(store.listPRs()).toHaveLength(1);
      });
    });

    describe("connections", () => {
      it("lists and deletes connections", () => {
        freshStore();
        expect(store.listConnections()).toHaveLength(1);
        store.deleteConnection(CONNECTION_ID);
        expect(store.listConnections()).toHaveLength(0);
      });
    });

    describe("session links", () => {
      it("upserts and lists session links", () => {
        freshStore();
        store.upsertSessionLink({ sessionId: "sess-1", workItemId: "item-1", matchMethod: "branch", linkedAt: "2026-01-16T10:00:00Z" });
        expect(store.listSessionLinks("item-1")).toHaveLength(1);
      });
    });

    describe("deleteAllWorkData", () => {
      it("removes all work data", () => {
        freshStore();
        for (const item of SYNC_1) store.upsertItem(item);
        store.deleteAllWorkData();
        expect(store.listItems()).toHaveLength(0);
        expect(store.listConnections()).toHaveLength(0);
      });
    });
  });
}
