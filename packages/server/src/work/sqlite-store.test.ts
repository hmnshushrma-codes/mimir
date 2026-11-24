import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import { runStoreContract } from "@agent-workshop/shared";
import { SqliteWorkStore } from "./sqlite-store.js";

// Use createRequire to load node:sqlite (Vitest's import analyzer strips "node:" prefix)
const { DatabaseSync: DatabaseSyncImpl } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

runStoreContract(() => new SqliteWorkStore(new DatabaseSyncImpl(":memory:") as DatabaseSync));
