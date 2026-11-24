import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import { SqliteWorkStore } from "./sqlite-store.js";
import { runStoreContract } from "./store-contract.js";

const { DatabaseSync: DatabaseSyncImpl } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

runStoreContract(() => new SqliteWorkStore(new DatabaseSyncImpl(":memory:") as DatabaseSync));
