#!/usr/bin/env node
/**
 * Cross-platform demo deploy wrapper.
 * Calls the bash deploy script (deploy requires bash for .env parsing).
 * On Windows, prints instructions to use WSL or Git Bash.
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (process.platform === "win32") {
  console.log("Demo deployment requires bash (Cloudflare wrangler + .env parsing).");
  console.log("On Windows, use one of:");
  console.log("  - Git Bash:  bash scripts/deploy-demo.sh");
  console.log("  - WSL:       wsl bash scripts/deploy-demo.sh");
  process.exit(1);
}

execSync("bash scripts/deploy-demo.sh", { stdio: "inherit", cwd: root });
