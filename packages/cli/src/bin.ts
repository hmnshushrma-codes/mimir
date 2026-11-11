#!/usr/bin/env node

// Entry point. Checks the Node version before loading main.ts, whose imports
// (node:sqlite, fastify) would otherwise crash with a cryptic error on old Node.

const MIN_NODE = [22, 13] as const;

const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  console.error(`mimir requires Node >= ${MIN_NODE.join(".")} (built-in SQLite). You are running Node ${process.versions.node}.`);
  console.error("Upgrade Node (e.g. `nvm install 22 && nvm use 22`) and try again.");
  process.exit(1);
}

// node:sqlite still emits an ExperimentalWarning on every run; hide just that one.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const message = typeof warning === "string" ? warning : warning.message;
  if (message.includes("SQLite is an experimental feature")) return;
  (emitWarning as (...args: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

await import("./main.js");
