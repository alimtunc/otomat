import { basename } from "node:path";

import {
  getProject,
  getProjectByRootPath,
  getRepository,
  insertProject,
  insertRepository,
  listRepositories,
  updateProjectRootPath,
  updateRepositoryDefaultBranch,
  type Db,
} from "@otomat/db";

import { detectDefaultBranch, tryRealpath } from "#git";

export const DEFAULT_PROJECT_ID = "local-default";
export const DEFAULT_REPOSITORY_ID = "local-default-repo";

/**
 * Anchors the daemon's boot root to a project row and returns its id. A root
 * already registered (Settings → Repositories) wins over the legacy default
 * project; otherwise the default project is created, or re-anchored when the
 * boot root moved between daemon starts.
 */
export function ensureDefaultProject(db: Db, rootPath: string): string {
  const canonical = tryRealpath(rootPath) ?? rootPath;
  const registered = getProjectByRootPath(db, canonical);
  if (registered) return registered.id;

  const existing = getProject(db, DEFAULT_PROJECT_ID);
  if (existing) {
    if (existing.root_path !== canonical) updateProjectRootPath(db, DEFAULT_PROJECT_ID, canonical);
    return DEFAULT_PROJECT_ID;
  }

  insertProject(db, { id: DEFAULT_PROJECT_ID, name: "Local workspace", root_path: canonical });
  return DEFAULT_PROJECT_ID;
}

/**
 * Ensures the project's repository row exists with a fresh default branch.
 * Null when the root is not a usable git repository (or HEAD is detached) —
 * runs on this project then have no worktree/diff. Row-only: worktree services
 * are built per repository by the resolver, never here.
 */
export function ensureDefaultRepository(
  db: Db,
  projectId: string,
  rootPath: string,
): string | null {
  const canonical = tryRealpath(rootPath) ?? rootPath;
  const defaultBranch = detectDefaultBranch(canonical);
  if (defaultBranch === null) {
    console.log(`[otomat] ${canonical} is not a usable git repository; runs will have no diff`);
    return null;
  }

  if (projectId !== DEFAULT_PROJECT_ID) return projectIdRepository(db, projectId);

  const existing = getRepository(db, DEFAULT_REPOSITORY_ID);
  if (existing) {
    if (existing.default_branch !== defaultBranch) {
      updateRepositoryDefaultBranch(db, DEFAULT_REPOSITORY_ID, defaultBranch);
    }
    return DEFAULT_REPOSITORY_ID;
  }

  insertRepository(db, {
    id: DEFAULT_REPOSITORY_ID,
    project_id: projectId,
    name: basename(canonical),
    default_branch: defaultBranch,
  });
  return DEFAULT_REPOSITORY_ID;
}

/** The boot root belongs to a registered project: reuse its repository, never duplicate it. */
function projectIdRepository(db: Db, projectId: string): string | null {
  const [repository] = listRepositories(db, { projectId });
  return repository ? repository.id : null;
}
