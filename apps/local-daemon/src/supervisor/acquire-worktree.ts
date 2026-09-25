import {
  GitCommandError,
  WorktreeConflictError,
  type AcquireWorktreeInput,
  type GitWorktreeService,
  type WorktreeRecord,
} from "#git";

import { LaunchRefusedError } from "./launch-target.js";

/** Node reports an unwritable or full data dir with a `syscall`; the launch cannot proceed, but the daemon is not broken. */
function isSystemError(error: unknown): boolean {
  return error instanceof Error && "syscall" in error && typeof error.syscall === "string";
}

/**
 * Turns an acquire failure the user can act on — git refused, the branch is
 * taken, the worktrees dir is unwritable — into a typed launch refusal carrying
 * the reason. Anything else is a daemon bug and keeps its own stack rather than
 * being reported as a repository the caller should go repair.
 */
export async function acquireRunWorktree(
  service: GitWorktreeService,
  input: AcquireWorktreeInput,
): Promise<WorktreeRecord> {
  try {
    return await service.acquire(input);
  } catch (error) {
    const actionable =
      error instanceof GitCommandError ||
      error instanceof WorktreeConflictError ||
      isSystemError(error);
    if (!actionable) throw error;
    throw new LaunchRefusedError(
      "worktree_unavailable",
      `could not create the worktree: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
