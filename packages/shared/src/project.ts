import { hashString } from "./hash.js";

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  /** Main repo's name, if this project's root is a git worktree. */
  worktreeOf: string | null;
  /** Current branch, or null when unknown/not refreshed this event. */
  branch: string | null;
}

function pathSegments(p: string): string[] {
  return p.split(/[\\/]/).filter(Boolean);
}

export function baseName(p: string): string {
  const segments = pathSegments(p);
  return segments[segments.length - 1] ?? p;
}

/** The directory one level up from `p`'s own basename — used to disambiguate
 *  two different projects that happen to share a folder name. */
export function parentFolderName(p: string): string | null {
  const segments = pathSegments(p);
  return segments.length >= 2 ? segments[segments.length - 2] : null;
}

/**
 * Pure, platform-agnostic project resolution used when no real git-aware
 * resolver is available (demo mode, or the rare event with no cwd at all).
 * The real server-side resolver (packages/server/src/project-resolver.ts)
 * supersedes this with git-rooted identity; this is only ever a fallback.
 */
export function fallbackProjectInfo(cwd: string | null): ProjectInfo {
  const root = cwd ?? "unknown";
  return {
    id: `fallback-${hashString(root).toString(16)}`,
    name: baseName(root),
    rootPath: root,
    worktreeOf: null,
    branch: null
  };
}

/**
 * Computes a display name per project id, appending the parent folder name
 * when two or more projects share the same base name (e.g. two unrelated
 * repos both called "api" become "api · work" and "api · personal").
 */
export function disambiguateProjectNames<T extends { id: string; name: string; rootPath: string }>(
  projects: T[]
): Record<string, string> {
  const byName = new Map<string, T[]>();
  for (const project of projects) {
    const list = byName.get(project.name) ?? [];
    list.push(project);
    byName.set(project.name, list);
  }

  const result: Record<string, string> = {};
  for (const list of byName.values()) {
    if (list.length === 1) {
      result[list[0].id] = list[0].name;
      continue;
    }
    for (const project of list) {
      const parent = parentFolderName(project.rootPath);
      result[project.id] = parent ? `${project.name} · ${parent}/` : project.name;
    }
  }
  return result;
}
