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
 * already registered through Settings wins over the legacy default project;
 * otherwise the default project is created or re-anchored after a move.
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
 * Returns null when no usable repository row can be established; worktree
 * services are created later by the repository resolver, never here.
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

  if (projectId !== DEFAULT_PROJECT_ID) {
    // A registered boot root already owns its repository; refresh it instead of duplicating it.
    const [repository] = listRepositories(db, { projectId });
    if (!repository) return null;
    if (repository.default_branch !== defaultBranch) {
      updateRepositoryDefaultBranch(db, repository.id, defaultBranch);
    }
    return repository.id;
  }

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
