import type { WorktreeStatus } from "../contracts/entities/workspace.js";
import type {
  WorkspaceAttachment,
  WorkspaceCleanupBlocker,
  WorkspaceCounts,
  WorkspaceEntry,
  WorkspaceState,
} from "../contracts/workspace-inventory.js";

export interface WorkspaceFacts {
  attachment: WorkspaceAttachment;
  registered: boolean;
  present: boolean;
  /** `null` for a worktree Otomat holds no row for. */
  record_status: WorktreeStatus | null;
  cycle_open: boolean;
  dirty: boolean | null;
  writer_alive: boolean;
}

export interface WorkspaceVerdict {
  state: WorkspaceState;
  blocker: WorkspaceCleanupBlocker | null;
}

/** A closed cycle was always closed explicitly, so what is left to protect is the work on disk, never the pull request. */
function cleanupBlocker(facts: WorkspaceFacts): WorkspaceCleanupBlocker | null {
  if (facts.writer_alive) return "writer_alive";
  if (facts.dirty === null) return "worktree_unreadable";
  return facts.dirty ? "worktree_dirty" : null;
}

export function projectWorkspaceState(facts: WorkspaceFacts): WorkspaceVerdict {
  if (facts.attachment === "none" || facts.attachment === "ambiguous") {
    return { state: "unmanaged", blocker: "unmanaged_worktree" };
  }
  if (facts.record_status === "archived" || facts.record_status === "removed") {
    return { state: "removed", blocker: null };
  }
  if (!facts.present) {
    return { state: facts.registered ? "stale" : "missing", blocker: null };
  }
  if (facts.cycle_open) return { state: "active", blocker: "cycle_open" };
  return { state: "cleanup_required", blocker: cleanupBlocker(facts) };
}

/** The one gate on a real deletion, so no surface offers one the daemon would refuse. */
export function isWorkspaceCleanable(verdict: WorkspaceVerdict): boolean {
  return verdict.state === "cleanup_required" && verdict.blocker === null;
}

/** The narrower rule for a deletion nobody confirmed one row at a time: only a merge already made it safe. */
export function isWorkspaceAutoDeletable(
  entry: WorkspaceVerdict & Pick<WorkspaceEntry, "pull_request">,
): boolean {
  return entry.pull_request?.merged === true && isWorkspaceCleanable(entry);
}

const BLOCKER_REASONS = {
  cycle_open: "The issue is still working here — merge or abandon its cycle first.",
  worktree_dirty: "Uncommitted changes are still in this worktree.",
  writer_alive: "A session is still running here — cancel the run first.",
  worktree_unreadable: "This worktree could not be read from disk.",
  unmanaged_worktree: "Otomat did not create this worktree, so it manages nothing here.",
} satisfies Record<WorkspaceCleanupBlocker, string>;

const STATE_REASONS = {
  active: BLOCKER_REASONS.cycle_open,
  cleanup_required: "Ready to delete: the cycle is closed and the worktree is clean.",
  stale: "The directory is gone; the git registration is pruned on the next reconcile.",
  missing: "Otomat records this worktree but git has no registration and the directory is gone.",
  unmanaged: BLOCKER_REASONS.unmanaged_worktree,
  removed: "Already cleaned up — nothing is left on disk.",
} satisfies Record<WorkspaceState, string>;

export function describeWorkspace(
  verdict: WorkspaceVerdict,
  attachment: WorkspaceAttachment,
): string {
  if (attachment === "ambiguous") {
    return "This worktree matches the Otomat layout but no record claims it, so it is left alone.";
  }
  if (verdict.blocker === null) return STATE_REASONS[verdict.state];
  return BLOCKER_REASONS[verdict.blocker];
}

export function countWorkspaces(entries: readonly WorkspaceEntry[]): WorkspaceCounts {
  const counts: WorkspaceCounts = {
    active: 0,
    cleanup_required: 0,
    stale: 0,
    missing: 0,
    unmanaged: 0,
  };
  for (const entry of entries) {
    if (entry.state !== "removed") counts[entry.state] += 1;
  }
  return counts;
}
