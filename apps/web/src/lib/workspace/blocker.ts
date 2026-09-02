import type { WorkspaceCleanupBlocker, WorkspaceEntry } from "@otomat/domain";

const BLOCKER_ACTIONS = {
  cycle_open: "Merge or abandon the cycle to release this workspace.",
  worktree_dirty: "Commit or discard the changes in the worktree first.",
  writer_alive: "Cancel the run, then reconcile.",
  worktree_unreadable: "Check the path on disk, then reconcile.",
  unmanaged_worktree: "Remove it yourself if you no longer need it.",
} satisfies Record<WorkspaceCleanupBlocker, string>;

export function workspaceReason(entry: Pick<WorkspaceEntry, "reason" | "blocker">): string {
  if (entry.blocker === null) return entry.reason;
  return `${entry.reason} ${BLOCKER_ACTIONS[entry.blocker]}`;
}
