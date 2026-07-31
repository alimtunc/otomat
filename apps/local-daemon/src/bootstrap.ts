import { basename } from "node:path";

import {
  getProject,
  getProjectByRootPath,
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
 * registered through Settings wins; once the default project owns a repository
 * its root is frozen — re-anchoring would silently point existing runs at a
 * different checkout.
 */
export function ensureDefaultProject(db: Db, rootPath: string): string {
  const canonical = tryRealpath(rootPath) ?? rootPath;
  const registered = getProjectByRootPath(db, canonical);
  if (registered) return registered.id;

  const existing = getProject(db, DEFAULT_PROJECT_ID);
  if (existing) {
    const owned = listRepositories(db, { projectId: DEFAULT_PROJECT_ID }).length > 0;
    if (!owned && existing.root_path !== canonical) {
      updateProjectRootPath(db, DEFAULT_PROJECT_ID, canonical);
    }
    return DEFAULT_PROJECT_ID;
  }

  insertProject(db, { id: DEFAULT_PROJECT_ID, name: "Local workspace", root_path: canonical });
  return DEFAULT_PROJECT_ID;
}

/**
 * Ensures the project's repository row exists with a fresh default branch.
 * Worktree services are created later by the repository resolver, never here.
 * The project's own root is the source of truth: a registration may have moved
 * it off the boot root.
 */
export function ensureDefaultRepository(db: Db, projectId: string): void {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`project ${projectId} disappeared during boot`);
  const canonical = project.root_path;
  const defaultBranch = detectDefaultBranch(canonical);

  const [existing] = listRepositories(db, { projectId });
  if (existing) {
    if (defaultBranch !== null && existing.default_branch !== defaultBranch) {
      updateRepositoryDefaultBranch(db, existing.id, defaultBranch);
    }
    return;
  }

  if (defaultBranch === null) {
    console.log(
      `[otomat] ${canonical} is not a usable git repository; register one to launch runs`,
    );
    return;
  }
  if (projectId !== DEFAULT_PROJECT_ID) return;

  insertRepository(db, {
    id: DEFAULT_REPOSITORY_ID,
    project_id: projectId,
    name: basename(canonical),
    default_branch: defaultBranch,
  });
}
