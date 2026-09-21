import { listRepositories } from "@otomat/db";
import type { WorkspaceReconcileReport } from "@otomat/domain";

import { isRepositoryRoot } from "#git";
import { pruneWorktrees } from "#git/worktree-cli";
import { updateWorktreeStatus } from "#git/worktrees-store";

import type { WorkspaceContext } from "./context.js";
import { cycleHolders, listWorkspaces, repositoryInventory } from "./inventory.js";

/** A pull-request refresh that cannot reach GitHub must not stop the git-side reconciliation. */
async function refreshPullRequests(context: WorkspaceContext): Promise<number> {
  if (context.refreshPullRequests === null) return 0;
  try {
    return await context.refreshPullRequests();
  } catch (error) {
    console.error("[otomat] pull request refresh during workspace reconciliation failed", error);
    return 0;
  }
}

/** Re-reads and converges only: a worktree still on disk is never deleted here, whatever auto-delete says. */
export async function reconcileWorkspaces(
  context: WorkspaceContext,
): Promise<WorkspaceReconcileReport> {
  const refreshed = await refreshPullRequests(context);
  let pruned = 0;
  let converged = 0;
  const holders = cycleHolders(context.db);

  for (const repository of listRepositories(context.db)) {
    const binding = context.repositories.forRepository(repository.id);
    if (!binding || !isRepositoryRoot(binding.rootPath)) continue;
    pruned += pruneWorktrees(binding.rootPath);
    for (const entry of repositoryInventory(context, repository, holders)) {
      if (entry.state !== "missing") continue;
      updateWorktreeStatus(context.db, entry.id, { status: "removed" });
      converged += 1;
      console.log(`[otomat] worktree record ${entry.id} converged: ${entry.path} is gone`);
    }
  }

  console.log(`[otomat] workspace reconciliation: ${pruned} pruned, ${converged} converged`);
  return {
    pull_requests_refreshed: refreshed,
    pruned,
    converged,
    inventory: listWorkspaces(context),
  };
}
