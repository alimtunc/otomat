import { listRepositories, readAutoDeleteWorkspaces } from "@otomat/db";
import {
  isWorkspaceAutoDeletable,
  type WorkspaceEntry,
  type WorkspaceReconcileReport,
} from "@otomat/domain";

import { isRepositoryRoot } from "#git";
import { pruneWorktrees } from "#git/worktree-cli";
import { updateWorktreeStatus } from "#git/worktrees-store";

import { cleanupWorkspace } from "./cleanup.js";
import type { WorkspaceContext } from "./context.js";
import { cycleHolders, listWorkspaces, repositoryInventory } from "./inventory.js";

interface Tally {
  pruned: number;
  converged: number;
  cleaned: number;
  skipped: number;
  failed: number;
}

function converge(context: WorkspaceContext, entry: WorkspaceEntry, tally: Tally): void {
  updateWorktreeStatus(context.db, entry.id, { status: "removed" });
  tally.converged += 1;
  console.log(`[otomat] worktree record ${entry.id} converged: ${entry.path} is gone`);
}

function applyEntry(
  context: WorkspaceContext,
  entry: WorkspaceEntry,
  autoDelete: boolean,
  tally: Tally,
): void {
  if (entry.state === "missing") return converge(context, entry, tally);
  if (entry.state !== "cleanup_required") return;
  if (!autoDelete || !isWorkspaceAutoDeletable(entry)) {
    tally.skipped += 1;
    return;
  }
  const result = cleanupWorkspace(context, entry);
  if (result.outcome === "cleaned") tally.cleaned += 1;
  else if (result.outcome === "failed") tally.failed += 1;
  else tally.skipped += 1;
}

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

/** The whole sequence, in the one order that converges; every reconciling path runs all of it. */
export async function reconcileWorkspaces(
  context: WorkspaceContext,
): Promise<WorkspaceReconcileReport> {
  const refreshed = await refreshPullRequests(context);
  const tally: Tally = { pruned: 0, converged: 0, cleaned: 0, skipped: 0, failed: 0 };
  const holders = cycleHolders(context.db);

  for (const repository of listRepositories(context.db)) {
    const binding = context.repositories.forRepository(repository.id);
    if (!binding || !isRepositoryRoot(binding.rootPath)) continue;
    tally.pruned += pruneWorktrees(binding.rootPath);
    const autoDelete = readAutoDeleteWorkspaces(context.db, repository.project_id);
    for (const entry of repositoryInventory(context, repository, holders)) {
      applyEntry(context, entry, autoDelete, tally);
    }
  }

  console.log(
    `[otomat] workspace reconciliation: ${tally.pruned} pruned, ${tally.converged} converged, ` +
      `${tally.cleaned} cleaned, ${tally.skipped} skipped, ${tally.failed} failed`,
  );
  return { pull_requests_refreshed: refreshed, ...tally, inventory: listWorkspaces(context) };
}
