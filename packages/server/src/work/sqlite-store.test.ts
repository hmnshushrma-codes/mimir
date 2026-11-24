import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
// Import directly from the test file, not via the shared barrel export
// (exporting a test file from index.ts pulls vitest into production runtime)
import { runStoreContract } from "../../../shared/src/work/store.test.js";
import { SqliteWorkStore } from "./sqlite-store.js";

// Use createRequire to load node:sqlite (Vitest's import analyzer strips "node:" prefix)
const { DatabaseSync: DatabaseSyncImpl } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

runStoreContract(() => new SqliteWorkStore(new DatabaseSyncImpl(":memory:") as DatabaseSync));
