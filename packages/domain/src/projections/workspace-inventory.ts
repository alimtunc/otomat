import type { WorktreeStatus } from "../contracts/entities/workspace.js";
import type {
  WorkspaceAttachment,
  WorkspaceCleanupBlocker,
  WorkspaceCounts,
  WorkspaceEntry,
  WorkspaceProvenance,
  WorkspaceState,
} from "../contracts/workspace-inventory.js";

export interface WorkspaceFacts {
  attachment: WorkspaceAttachment;
  registered: boolean;
  present: boolean;
  /** `null` for a worktree Otomat holds no row for. */
  record_status: WorktreeStatus | null;
  cycle_open: boolean;
  uncommitted_files: number | null;
  writer_alive: boolean;
}

export interface WorkspaceVerdict {
  state: WorkspaceState;
  blocker: WorkspaceCleanupBlocker | null;
}

/** A closed cycle was always closed explicitly, so what is left to protect is the work on disk, never the pull request. */
function cleanupBlocker(facts: WorkspaceFacts): WorkspaceCleanupBlocker | null {
  if (facts.writer_alive) return "writer_alive";
  if (facts.uncommitted_files === null) return "worktree_unreadable";
  return facts.uncommitted_files > 0 ? "worktree_dirty" : null;
}

export function projectWorkspaceState(facts: WorkspaceFacts): WorkspaceVerdict {
  if (facts.attachment === "none") {
    return { state: "unmanaged", blocker: "unmanaged_worktree" };
  }
  if (facts.attachment === "ambiguous") {
    return { state: "unmanaged", blocker: cleanupBlocker(facts) };
  }
  if (facts.record_status === "archived" || facts.record_status === "removed") {
    return { state: "removed", blocker: null };
  }
  if (!facts.present) {
    return {
      state: facts.registered ? "stale" : "missing",
      blocker: facts.writer_alive ? "writer_alive" : null,
    };
  }
  if (facts.cycle_open) return { state: "active", blocker: "cycle_open" };
  return { state: "cleanup_required", blocker: cleanupBlocker(facts) };
}

export function projectWorkspaceProvenance(facts: WorkspaceFacts): WorkspaceProvenance {
  if (facts.attachment === "none") return "external_worktree";
  if (facts.attachment === "ambiguous") return "otomat_unreconciled";
  if (!facts.present) return facts.registered ? "missing_path" : "orphan_record";
  return facts.registered ? "otomat_run" : "unknown";
}

/** The one gate on a real deletion, so no surface offers one the daemon would refuse. */
export function isWorkspaceCleanable(verdict: WorkspaceVerdict): boolean {
  return (
    (verdict.state === "cleanup_required" || verdict.state === "unmanaged") &&
    verdict.blocker === null
  );
}

/** The wider gate a reinforced confirmation opens: work left on disk is the only refusal it overrides. */
export function isWorkspaceForceCleanable(verdict: WorkspaceVerdict): boolean {
  if (verdict.state === "active" || verdict.state === "removed") return false;
  return (
    verdict.blocker === null ||
    verdict.blocker === "worktree_dirty" ||
    verdict.blocker === "worktree_unreadable"
  );
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
  unmanaged_worktree:
    "Git does not hold this worktree under Otomat's worktrees root, so nothing here may delete it.",
} satisfies Record<WorkspaceCleanupBlocker, string>;

const PROVENANCE_REASONS = {
  otomat_run: "Ready to delete: the cycle is closed and the worktree is clean.",
  otomat_unreconciled:
    "An earlier Otomat worktree no record claims any more; deleting it leaves its branch alone.",
  external_worktree: BLOCKER_REASONS.unmanaged_worktree,
  missing_path: "The directory is gone; the git registration is pruned on the next reconcile.",
  orphan_record:
    "Otomat records this worktree but git has no registration and the directory is gone.",
  unknown:
    "Otomat records this directory but git no longer registers it — reconcile before deleting.",
} satisfies Record<WorkspaceProvenance, string>;

export function describeWorkspace(
  verdict: WorkspaceVerdict,
  provenance: WorkspaceProvenance,
): string {
  if (verdict.state === "removed") return "Already cleaned up — nothing is left on disk.";
  if (verdict.blocker !== null) return BLOCKER_REASONS[verdict.blocker];
  return PROVENANCE_REASONS[provenance];
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
