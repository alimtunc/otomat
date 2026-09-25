import { join, relative } from "node:path";

import { WorktreeConflictError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { canonicalPath, isInsideRoot, tryRealpath } from "./probe.js";
import { listWorktrees } from "./worktree-cli.js";

export async function validateInteractiveWorktree(
  root: string,
  repository: string,
  path: string,
  branch: string,
): Promise<void> {
  const canonical = tryRealpath(path);
  const canonicalRoot = tryRealpath(root);
  if (canonical === null || canonicalRoot === null)
    throw new WorktreeConflictError(
      "The canonical worktree is missing or unreadable. Restore it before opening a terminal.",
    );
  if (
    canonical !== join(canonicalRoot, relative(root, path)) ||
    !isInsideRoot(canonicalRoot, canonical)
  ) {
    throw new WorktreeConflictError("The canonical worktree path has changed.");
  }
  const commonDirectories = await Promise.all(
    [repository, canonical].map(async (cwd) => {
      const result = await runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], {
        cwd,
        allowFailure: true,
      });
      return result.exitCode === 0 ? canonicalPath(result.stdout.trim()) : null;
    }),
  );
  if (commonDirectories[0] === null || commonDirectories[0] !== commonDirectories[1])
    throw new WorktreeConflictError("The worktree belongs to a different Git repository.");
  const entry = (await listWorktrees(repository)).find(
    (row) => canonicalPath(row.path) === canonical,
  );
  if (!entry || entry.branch !== branch || entry.bare || entry.detached) {
    throw new WorktreeConflictError("Git no longer registers the canonical worktree and branch.");
  }
}
