import type { WorkspaceCleanupBlocker } from "@otomat/domain";

const BLOCKER_ACTIONS: Record<WorkspaceCleanupBlocker, string> = {
  cycle_open: "Merge or abandon the cycle to release this workspace.",
  pull_request_not_merged: "Merge the pull request, or abandon the cycle and clean it by hand.",
  worktree_dirty: "Commit or discard the changes in the worktree first.",
  writer_alive: "Cancel the run, then reconcile.",
  worktree_unreadable: "Check the path on disk, then reconcile.",
  unmanaged_worktree: "Remove it yourself if you no longer need it.",
};

export function workspaceBlockerAction(blocker: WorkspaceCleanupBlocker | null): string | null {
  return blocker === null ? null : BLOCKER_ACTIONS[blocker];
}
