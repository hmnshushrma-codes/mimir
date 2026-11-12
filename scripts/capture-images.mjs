#!/usr/bin/env node
// Regenerates the screenshots (README + docs page) and the Open Graph image
// from the demo build. Run `pnpm demo:build` first, then `pnpm demo:images`.
//
// Uses your installed Google Chrome via playwright-core — no browser download.
//
// Writes:
//   packages/web/public/screenshots/workshop.png   (README, docs)
//   packages/web/public/screenshots/analytics.png  (README, docs)
//   packages/web/public/og-image.png               (1200x630 link preview)

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "packages/web");
const distDemo = join(web, "dist-demo");
const shotsDir = join(web, "public/screenshots");
const PORT = 4174;
const URL = `http://localhost:${PORT}/`;

// The demo scenario needs ~20s before all subagents are at their desks.
const SETTLE_MS = 22000;

if (!existsSync(join(distDemo, "index.html"))) {
  console.error("No demo build found — run `pnpm demo:build` first.");
  process.exit(1);
}

const server = spawn("pnpm", ["exec", "vite", "preview", "--outDir", "dist-demo", "--port", String(PORT), "--strictPort"], {
  cwd: web,
  stdio: "ignore"
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`demo preview did not start on ${URL}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: "chrome" });
  mkdirSync(shotsDir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(URL);
  console.log(`Waiting ${SETTLE_MS / 1000}s for the demo scenario to play out...`);
  await page.waitForTimeout(SETTLE_MS);

  const workshop = join(shotsDir, "workshop.png");
  await page.screenshot({ path: workshop });
  console.log(`✓ ${workshop}`);

  // Tighter crop of the room itself, for the OG image
  const ogWorkshop = await page.screenshot({ clip: { x: 16, y: 150, width: 420, height: 640 } });

  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page.waitForTimeout(1500);
  const analytics = join(shotsDir, "analytics.png");
  await page.screenshot({ path: analytics, clip: { x: 0, y: 0, width: 1280, height: 440 } });
  console.log(`✓ ${analytics}`);

  // Tokens subtab
  const tokensBtn = page.locator("button.subtab", { hasText: "Tokens" });
  if (await tokensBtn.isVisible()) {
    await tokensBtn.click();
    await page.waitForTimeout(1000);
    const tokens = join(shotsDir, "tokens.png");
    await page.screenshot({ path: tokens, clip: { x: 0, y: 0, width: 1280, height: 700 } });
    console.log(`✓ ${tokens}`);
  }

  // Back to Workshop for permission popup screenshot
  await page.getByRole("button", { name: "Workshop", exact: true }).click();
  await page.waitForTimeout(500);
  // Trigger a permission via demo control bar
  const permBtn = page.locator("button.demo-btn", { hasText: "Destructive" });
  if (await permBtn.isVisible()) {
    await permBtn.click();
    await page.waitForTimeout(800);
    const permission = join(shotsDir, "permission.png");
    await page.screenshot({ path: permission });
    console.log(`✓ ${permission}`);
  }

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const template = readFileSync(join(root, "scripts/og-template.html"), "utf-8").replace(
    "{{WORKSHOP}}",
    `data:image/png;base64,${ogWorkshop.toString("base64")}`
  );
  await og.setContent(template, { waitUntil: "load" });
  const ogPath = join(web, "public/og-image.png");
  writeFileSync(ogPath, await og.screenshot({ type: "png" }));
  console.log(`✓ ${ogPath}`);
} finally {
  await browser?.close();
  server.kill();
}
