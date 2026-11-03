import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));

/** Modules that belonged to the deleted mood/profile rendering system —
 *  behaviourFor(displayState) is the only source of every visual layer now
 *  (see packages/web/src/rig). No component or view may import these. */
const BANNED_IMPORT_PATTERNS = [
  /characters\/Character(\.js)?["']/,
  /characters\/characterProfiles(\.js)?["']/,
  /characters\/MoodIcon(\.js)?["']/,
  /characters\/Face(\.js)?["']/,
  /characters\/RoleAccessory(\.js)?["']/,
  /["']@agent-workshop\/shared["'][^;]*\bMood\b/
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("architecture — rendering components never touch the deleted mood system", () => {
  const scanDirs = ["components", "views"].map((d) => join(SRC_DIR, d));
  const files = scanDirs.flatMap(listFiles);

  it("found a non-trivial number of component/view files to scan", () => {
    // Guards against this test silently passing because the glob is wrong.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f] as const))("%s imports nothing from the deleted mood/profile system", (file) => {
    const contents = readFileSync(file, "utf8");
    for (const pattern of BANNED_IMPORT_PATTERNS) {
      expect(contents).not.toMatch(pattern);
    }
  });
});
