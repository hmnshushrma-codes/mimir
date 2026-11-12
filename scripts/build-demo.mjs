#!/usr/bin/env node
/**
 * Cross-platform demo build script.
 * Replaces build-demo.sh for Windows/Mac/Linux compatibility.
 *
 *   node scripts/build-demo.mjs            Build + check
 *   node scripts/build-demo.mjs --preview  Build + check, then serve locally
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const OUT_DIR = join("packages", "web", "dist-demo");
const mode = process.argv[2] ?? "check";

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function fail(msg) {
  console.error(`\u2717 ${msg}`);
  process.exit(1);
}

console.log("=== Mimir: Building demo ===\n");

run("pnpm --filter @agent-workshop/shared run build");
run("pnpm --filter @agent-workshop/web exec tsc -b");

// Set VITE_DEMO=true for the build
const env = { ...process.env, VITE_DEMO: "true" };
execSync(`pnpm --filter @agent-workshop/web exec vite build --outDir dist-demo --emptyOutDir`, {
  stdio: "inherit",
  cwd: root,
  env,
});

console.log("\n=== Checking demo build ===\n");

const indexPath = join(OUT_DIR, "index.html");
if (!existsSync(indexPath)) fail(`${indexPath} is missing`);

const assetsDir = join(OUT_DIR, "assets");
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  : [];
if (jsFiles.length === 0) fail(`no JS assets in ${assetsDir}`);
console.log("\u2713 index.html and assets present");

// Check for localhost references in the bundle
for (const jsFile of jsFiles) {
  const content = readFileSync(join(assetsDir, jsFile), "utf-8");
  if (/localhost|127\.0\.0\.1/.test(content)) {
    fail(`demo bundle references localhost in ${jsFile} — it would reach visitors' local Mimir`);
  }
}
console.log("\u2713 no localhost / 127.0.0.1 references in the bundle");

// Size
let totalBytes = 0;
function dirSize(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) dirSize(full);
    else totalBytes += statSync(full).size;
  }
}
dirSize(OUT_DIR);
const sizeKB = (totalBytes / 1024).toFixed(0);
const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
console.log(`\u2713 build size: ${totalBytes > 1024 * 1024 ? sizeMB + "M" : sizeKB + "K"}`);

if (mode === "check") {
  console.log(`\nDemo build OK: ${OUT_DIR}`);
  console.log(`Preview:  node scripts/build-demo.mjs --preview`);
  console.log(`Deploy:   node scripts/deploy-demo.mjs`);
} else if (mode === "--preview") {
  console.log("\n=== Serving demo at http://localhost:4173 (Ctrl+C to stop) ===\n");
  run("pnpm --filter @agent-workshop/web exec vite preview --outDir dist-demo --port 4173");
} else {
  fail(`unknown option: ${mode} (use --preview)`);
}
