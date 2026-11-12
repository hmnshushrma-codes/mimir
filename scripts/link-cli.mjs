#!/usr/bin/env node
// Puts the `mimir` command on PATH for a from-source install by symlinking
// packages/cli/dist/bin.js into npm's global bin directory. (`npm link` chokes
// on pnpm's workspace:* dependencies, and `pnpm link --global` needs `pnpm setup`.)

import { execSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "packages/cli/dist/bin.js");

if (!existsSync(target)) {
  console.error(`Missing ${target} — run \`pnpm build\` first.`);
  process.exit(1);
}

if (process.platform === "win32") {
  console.log("On Windows, run `pnpm start` from the repo instead of the global `mimir` command.");
  process.exit(0);
}

const prefix = execSync("npm prefix -g", { encoding: "utf-8" }).trim();
const binDir = join(prefix, "bin");
const link = join(binDir, "mimir");

chmodSync(target, 0o755);
mkdirSync(binDir, { recursive: true });
try {
  if (lstatSync(link)) rmSync(link);
} catch {
  // No existing link
}

try {
  symlinkSync(target, link);
} catch (err) {
  console.error(`Could not create ${link}: ${err.message}`);
  console.error(`Try: sudo ln -sf "${target}" "${link}"  — or just use \`pnpm start\`.`);
  process.exit(1);
}

console.log(`✓ Linked ${link} -> ${target}`);
if (!(process.env.PATH ?? "").split(delimiter).includes(binDir)) {
  console.log(`  Note: ${binDir} is not on your PATH — add it to use \`mimir\` directly.`);
}
