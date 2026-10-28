import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectInfo } from "@agent-workshop/shared";

const execFileAsync = promisify(execFile);

/** Windows' git sometimes returns an 8.3 short-path form (C:\...\HIMANS~1\...)
 *  for the same directory a long-path cwd was given in. Left unnormalized,
 *  the same real project could hash to two different ids depending on which
 *  spelling happened to come back. realpathSync resolves both forms (and
 *  symlinks) to one canonical path. */
function canonicalize(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function hashPath(p: string): string {
  return createHash("sha1").update(p).digest("hex").slice(0, 16);
}

async function tryGit(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: 2000 });
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

interface CachedEntry {
  info: ProjectInfo;
  /** Set only once, when we first discover this cwd is NOT a git repo —
   *  avoids re-spawning git on every event for non-repo cwds. */
  isGitRepo: boolean;
}

const cache = new Map<string, CachedEntry>();

/**
 * Resolves a cwd to a stable project identity: the git repo root (so every
 * subdirectory of the same repo maps to one project), or the bare cwd folder
 * name when it isn't a git repo at all. Worktrees resolve to the *main*
 * repo's name plus a worktree label, per docs/hook-events.md's project
 * identity rules. Cached per cwd — the only repeated cost is a cheap `git
 * branch --show-current` re-query, which callers opt into via
 * `refreshBranch` (SessionStart / UserPromptSubmit only).
 */
export async function resolveProject(cwd: string, options: { refreshBranch: boolean } = { refreshBranch: false }): Promise<ProjectInfo> {
  const cached = cache.get(cwd);
  if (cached) {
    if (!options.refreshBranch || !cached.isGitRepo) return cached.info;
    const branch = await tryGit(["branch", "--show-current"], cwd);
    const info = { ...cached.info, branch };
    cache.set(cwd, { info, isGitRepo: cached.isGitRepo });
    return info;
  }

  const toplevel = await tryGit(["rev-parse", "--show-toplevel"], cwd);
  const isGitRepo = toplevel !== null;
  const rootPath = canonicalize(path.resolve(toplevel ?? cwd));
  let worktreeOf: string | null = null;

  if (toplevel) {
    const [gitDir, commonDir] = await Promise.all([
      tryGit(["rev-parse", "--git-dir"], cwd),
      tryGit(["rev-parse", "--git-common-dir"], cwd)
    ]);
    if (gitDir && commonDir) {
      const absGitDir = canonicalize(path.resolve(cwd, gitDir));
      const absCommonDir = canonicalize(path.resolve(cwd, commonDir));
      if (absGitDir !== absCommonDir) {
        // Worktree: the main repo's root is the parent of the shared .git dir.
        const mainRoot = path.dirname(absCommonDir);
        worktreeOf = path.basename(mainRoot);
      }
    }
  }

  const branch = isGitRepo ? await tryGit(["branch", "--show-current"], cwd) : null;
  const name = path.basename(rootPath);

  const info: ProjectInfo = { id: hashPath(rootPath), name, rootPath, worktreeOf, branch };
  cache.set(cwd, { info, isGitRepo });
  return info;
}

export function clearProjectResolverCache(): void {
  cache.clear();
}
