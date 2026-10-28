import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";
import { resolveProject } from "./project-resolver.js";

export interface DetectedSession {
  sessionId: string;
  projectName: string;
  cwd: string | null;
  lastModified: string;
}

function projectsRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/** Reads only the first line of a transcript to recover its cwd — never
 *  writes, never loads the whole file. */
function readFirstLineCwd(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream });
    let settled = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      rl.close();
      stream.destroy();
      resolve(value);
    };

    rl.on("line", (line) => {
      try {
        const parsed = JSON.parse(line) as { cwd?: unknown };
        finish(typeof parsed.cwd === "string" ? parsed.cwd : null);
      } catch {
        finish(null);
      }
    });
    rl.on("close", () => finish(null));
    stream.on("error", () => finish(null));
  });
}

/**
 * Read-only discovery of Claude Code sessions that are writing a transcript
 * but haven't sent us any hook events — e.g. a session started before hooks
 * were installed. Never modifies anything it scans; only reads directory
 * listings, mtimes, and the first line of each transcript.
 */
export class DetectedSessionScanner {
  private detected = new Map<string, DetectedSession>();

  constructor(
    private readonly windowMs: number,
    private readonly isTracked: (sessionId: string) => boolean
  ) {}

  async scan(): Promise<void> {
    const root = projectsRoot();
    if (!existsSync(root)) return;

    const now = Date.now();
    const next = new Map<string, DetectedSession>();

    let projectDirs: string[];
    try {
      projectDirs = readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return;
    }

    for (const dir of projectDirs) {
      const dirPath = path.join(root, dir);
      let entries: string[];
      try {
        entries = readdirSync(dirPath, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
          .map((e) => e.name);
      } catch {
        continue;
      }

      for (const fileName of entries) {
        const sessionId = fileName.slice(0, -".jsonl".length);
        if (this.isTracked(sessionId)) continue;

        const filePath = path.join(dirPath, fileName);
        let mtimeMs: number;
        try {
          mtimeMs = statSync(filePath).mtimeMs;
        } catch {
          continue;
        }
        if (now - mtimeMs > this.windowMs) continue;

        const cwd = await readFirstLineCwd(filePath);
        const projectName = cwd ? (await resolveProject(cwd)).name : dir;

        next.set(sessionId, { sessionId, projectName, cwd, lastModified: new Date(mtimeMs).toISOString() });
      }
    }

    this.detected = next;
  }

  list(): DetectedSession[] {
    return Array.from(this.detected.values());
  }
}
