import { getRepository, type Db } from "@otomat/db";
import {
  describeWorkspace,
  isWorkspaceCleanable,
  type WorkspaceCleanupResult,
  type WorkspaceEntry,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { deleteBranch } from "#git/repo";
import { pruneWorktrees, removeWorktreeSafely } from "#git/worktree-cli";
import { findWorktreeById, updateWorktreeStatus } from "#git/worktrees-store";

import { buildWorkspaceCleanedEvent } from "../markers.js";
import type { WorkspaceContext } from "./context.js";
import { repositoryInventory } from "./inventory.js";

/** Re-classified from git here, so a cleanup never acts on a verdict a caller has been holding. */
export function findWorkspaceEntry(
  context: WorkspaceContext,
  worktreeId: string,
  holders: Map<string, string>,
): WorkspaceEntry | null {
  const row = findWorktreeById(context.db, worktreeId);
  if (!row) return null;
  const repository = getRepository(context.db, row.repository_id);
  if (!repository) return null;
  return (
    repositoryInventory(context, repository, holders).find((entry) => entry.id === worktreeId) ??
    null
  );
}

function audit(db: Db, dataDir: string, entry: WorkspaceEntry): void {
  if (entry.run_id === null || entry.branch === null) return;
  emitLedgerEvent(
    db,
    dataDir,
    entry.run_id,
    buildWorkspaceCleanedEvent(entry.run_id, entry.branch, entry.path, new Date().toISOString()),
  );
}

/** A git refusal leaves the record untouched, so the workspace stays retryable. */
export function cleanupWorkspace(
  context: WorkspaceContext,
  entry: WorkspaceEntry,
): WorkspaceCleanupResult {
  if (!isWorkspaceCleanable(entry)) {
    return { outcome: "skipped", blocker: entry.blocker, message: entry.reason, entry };
  }
  const refusal = removeWorktreeSafely(entry.repository_path, entry.path);
  if (refusal !== null) {
    console.error(`[otomat] worktree removal refused for ${entry.path}: ${refusal}`);
    return {
      outcome: "failed",
      blocker: null,
      message: refusal === "" ? "git refused to remove this worktree." : refusal,
      entry,
    };
  }
  pruneWorktrees(entry.repository_path);
  if (entry.branch !== null) deleteBranch(entry.repository_path, entry.branch);
  updateWorktreeStatus(context.db, entry.id, { status: "removed" });
  audit(context.db, context.dataDir, entry);
  return {
    outcome: "cleaned",
    blocker: null,
    message: `Removed ${entry.path}.`,
    entry: {
      ...entry,
      state: "removed",
      present: false,
      registered: false,
      blocker: null,
      reason: describeWorkspace({ state: "removed", blocker: null }, entry.attachment),
    },
  };
}
