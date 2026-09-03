import type { WorkspaceCleanupBlocker, WorkspaceEntry } from "@otomat/domain";

// The domain reason already names the action where the value is null.
const BLOCKER_ACTIONS = {
  cycle_open: null,
  worktree_dirty: "Commit or discard the changes in the worktree first.",
  writer_alive: null,
  worktree_unreadable: "Check the path on disk, then reconcile.",
  unmanaged_worktree: "Remove it yourself if you no longer need it.",
} satisfies Record<WorkspaceCleanupBlocker, string | null>;

export function workspaceReason(entry: Pick<WorkspaceEntry, "reason" | "blocker">): string {
  const action = entry.blocker === null ? null : BLOCKER_ACTIONS[entry.blocker];
  return action === null ? entry.reason : `${entry.reason} ${action}`;
}
