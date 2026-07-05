import { basename, join } from "node:path";

import { getRepository, insertRepository, upsertProject, type Db } from "@otomat/db";

import { createGitWorktreeService, detectDefaultBranch } from "#git";
import type { WorktreeBinding } from "#supervisor";

export const DEFAULT_PROJECT_ID = "local-default";
export const DEFAULT_REPOSITORY_ID = "local-default-repo";

/** Idempotently upserts the local default project at `rootPath`; always returns `DEFAULT_PROJECT_ID`. */
export function ensureDefaultProject(db: Db, rootPath: string): string {
  upsertProject(db, { id: DEFAULT_PROJECT_ID, name: "Local workspace", root_path: rootPath });
  return DEFAULT_PROJECT_ID;
}

/** Null when the project root is not a git repository (or HEAD is detached) — runs then have no worktree/diff. */
export function ensureDefaultRepository(
  db: Db,
  projectId: string,
  rootPath: string,
  dataDir: string,
): WorktreeBinding | null {
  const defaultBranch = detectDefaultBranch(rootPath);
  if (defaultBranch === null) {
    console.log(`[otomat] ${rootPath} is not a usable git repository; runs will have no diff`);
    return null;
  }

  if (!getRepository(db, DEFAULT_REPOSITORY_ID)) {
    insertRepository(db, {
      id: DEFAULT_REPOSITORY_ID,
      project_id: projectId,
      name: basename(rootPath),
      default_branch: defaultBranch,
    });
  }

  const service = createGitWorktreeService({
    db,
    repositoryId: DEFAULT_REPOSITORY_ID,
    repoRoot: rootPath,
    defaultBranch,
    worktreesRoot: process.env.OTOMAT_WORKTREES_ROOT ?? join(dataDir, "worktrees"),
  });
  return { repositoryId: DEFAULT_REPOSITORY_ID, service };
}
