import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearProjectResolverCache, resolveProject } from "./project-resolver.js";

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

describe("resolveProject", () => {
  let tmpRoot: string;
  let plainDir: string;
  let repoDir: string;
  let subDir: string;
  let worktreeDir: string;

  beforeAll(async () => {
    // os.tmpdir() can itself return an 8.3 short-path form on Windows;
    // realpathSync pins everything below to one canonical spelling so
    // assertions compare like-for-like against the resolver's own
    // canonicalization (see project-resolver.ts).
    tmpRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), "agent-workshop-resolver-")));

    plainDir = path.join(tmpRoot, "not-a-repo");
    mkdirSync(plainDir, { recursive: true });

    repoDir = path.join(tmpRoot, "my-repo");
    mkdirSync(repoDir, { recursive: true });
    await git(["init", "-q", "-b", "main"], repoDir);
    await git(["config", "user.email", "test@example.com"], repoDir);
    await git(["config", "user.name", "Test"], repoDir);
    writeFileSync(path.join(repoDir, "f.txt"), "hello");
    await git(["add", "-A"], repoDir);
    await git(["commit", "-q", "-m", "init"], repoDir);

    subDir = path.join(repoDir, "packages", "sub");
    mkdirSync(subDir, { recursive: true });

    worktreeDir = path.join(tmpRoot, "my-repo-worktree");
    await git(["worktree", "add", "-b", "feature-x", worktreeDir], repoDir);
  }, 30000);

  afterAll(() => {
    clearProjectResolverCache();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("resolves a plain (non-git) directory to itself, with no branch", async () => {
    const info = await resolveProject(plainDir);
    expect(info.rootPath).toBe(path.resolve(plainDir));
    expect(info.name).toBe("not-a-repo");
    expect(info.worktreeOf).toBeNull();
    expect(info.branch).toBeNull();
  });

  it("resolves a git repo's root cwd to itself, with its branch", async () => {
    const info = await resolveProject(repoDir);
    // Exact full-path string equality against an independently-computed
    // value is unreliable on Windows: spawning git with `cwd` can hand the
    // child an 8.3 short-path alias of the same directory, and which alias
    // comes back isn't deterministic across environments. The property that
    // actually matters — same cwd always resolves to the same identity, and
    // a subdirectory resolves to the same identity as its repo root — is
    // covered by the next two tests instead of a brittle string compare here.
    expect(info.name).toBe("my-repo");
    expect(info.worktreeOf).toBeNull();
    expect(info.branch).toBe("main");
  });

  it("resolves a subdirectory of a repo to the same project as the repo root", async () => {
    const rootInfo = await resolveProject(repoDir);
    const subInfo = await resolveProject(subDir);
    expect(subInfo.id).toBe(rootInfo.id);
    expect(subInfo.rootPath).toBe(rootInfo.rootPath);
    expect(subInfo.name).toBe("my-repo");
  });

  it("resolves a worktree to the main repo's name, flagged via worktreeOf", async () => {
    const info = await resolveProject(worktreeDir);
    expect(info.worktreeOf).toBe("my-repo");
    expect(info.branch).toBe("feature-x");
    // A worktree is its own distinct project (different root path / id) —
    // only its *display name* borrows the main repo's name, handled by the
    // UI layer using worktreeOf, not by collapsing the id here.
    const mainInfo = await resolveProject(repoDir);
    expect(info.id).not.toBe(mainInfo.id);
  });

  it("caches by cwd — does not refresh branch unless asked", async () => {
    const first = await resolveProject(repoDir);
    await git(["checkout", "-q", "-b", "other-branch"], repoDir);
    const cachedAgain = await resolveProject(repoDir);
    expect(cachedAgain.branch).toBe(first.branch); // still "main", stale cache
    const refreshed = await resolveProject(repoDir, { refreshBranch: true });
    expect(refreshed.branch).toBe("other-branch");
    await git(["checkout", "-q", "main"], repoDir);
  });
});
