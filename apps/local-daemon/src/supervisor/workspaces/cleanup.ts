import { getRepository } from "@otomat/db";
import {
  describeWorkspace,
  isWorkspaceCleanable,
  isWorkspaceForceCleanable,
  type WorkspaceCleanupResult,
  type WorkspaceEntry,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { isInsideRoot } from "#git";
import { deleteBranch } from "#git/repo";
import { pruneWorktrees, removeWorktree } from "#git/worktree-cli";
import { findWorktreeById, updateWorktreeStatus } from "#git/worktrees-store";

import { buildWorkspaceCleanedEvent } from "../markers.js";
import type { WorkspaceContext } from "./context.js";
import { listWorkspaces, repositoryInventory } from "./inventory.js";

/** Re-classified from git here, so a cleanup never acts on a verdict a caller has been holding. */
export function findWorkspaceEntry(
  context: WorkspaceContext,
  workspaceId: string,
  holders: Map<string, string>,
): WorkspaceEntry | null {
  const row = findWorktreeById(context.db, workspaceId);
  const repository = row === undefined ? undefined : getRepository(context.db, row.repository_id);
  // A worktree Otomat holds no row for is identified by its path, so it is found by listing.
  const entries = repository
    ? repositoryInventory(context, repository, holders)
    : listWorkspaces(context).entries;
  return entries.find((entry) => entry.id === workspaceId) ?? null;
}

function audit(context: WorkspaceContext, entry: WorkspaceEntry, forced: boolean): void {
  console.log(
    `[otomat] workspace ${entry.id} deleted${forced ? " (forced)" : ""}: ${entry.path}` +
      ` on branch ${entry.branch ?? "(detached)"}`,
  );
  if (entry.run_id === null || entry.branch === null) return;
  emitLedgerEvent(
    context.db,
    context.dataDir,
    entry.run_id,
    buildWorkspaceCleanedEvent(
      entry.run_id,
      entry.branch,
      entry.path,
      forced,
      new Date().toISOString(),
    ),
  );
}

function refused(entry: WorkspaceEntry, message: string): WorkspaceCleanupResult {
  return { outcome: "skipped", blocker: entry.blocker, message, entry };
}

interface WorkspaceCleanupOptions {
  /** Discards uncommitted work instead of refusing; only an explicit operator confirmation sets it. */
  force: boolean;
}

/** A git refusal leaves the record untouched, so the workspace stays retryable. */
export function cleanupWorkspace(
  context: WorkspaceContext,
  entry: WorkspaceEntry,
  options: WorkspaceCleanupOptions = { force: false },
): WorkspaceCleanupResult {
  if (!isInsideRoot(context.repositories.worktreesRoot, entry.path)) {
    return refused(entry, `${entry.path} is outside the worktrees Otomat may delete.`);
  }
  if (entry.present && !entry.registered) {
    return refused(entry, `Git no longer registers ${entry.path} — reconcile before deleting it.`);
  }
  const eligible = options.force ? isWorkspaceForceCleanable(entry) : isWorkspaceCleanable(entry);
  if (!eligible) return refused(entry, entry.reason);
  // The branch is this cycle's only while the row that named the worktree still names it.
  const record = findWorktreeById(context.db, entry.id);
  const ownedBranch = record?.branch === entry.branch ? entry.branch : null;

  // Only a registration is removable, directory or not; an orphan record has none and prune converges it.
  if (entry.registered) {
    const refusal = removeWorktree(entry.repository_path, entry.path, { force: options.force });
    if (refusal !== null) {
      console.error(`[otomat] worktree removal refused for ${entry.path}: ${refusal}`);
      return {
        outcome: "failed",
        blocker: null,
        message: refusal === "" ? "git refused to remove this worktree." : refusal,
        entry,
      };
    }
  }
  pruneWorktrees(entry.repository_path);
  if (ownedBranch !== null) deleteBranch(entry.repository_path, ownedBranch);
  if (record) updateWorktreeStatus(context.db, entry.id, { status: "removed" });
  audit(context, entry, options.force);
  return {
    outcome: "cleaned",
    blocker: null,
    message:
      ownedBranch === null
        ? `Removed ${entry.path}; its branch was left alone.`
        : `Removed ${entry.path} and its branch.`,
    entry: {
      ...entry,
      state: "removed",
      present: false,
      registered: false,
      blocker: null,
      uncommitted_files: 0,
      unpushed_commits: ownedBranch === null ? entry.unpushed_commits : 0,
      reason: describeWorkspace({ state: "removed", blocker: null }, entry.provenance),
    },
  };
}
