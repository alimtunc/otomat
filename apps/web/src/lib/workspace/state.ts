import type { WorkspaceState } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export interface WorkspaceStateDescriptor {
  label: string;
  tone: StatusTone;
}

export const WORKSPACE_STATE = {
  active: { label: "Active", tone: "live" },
  cleanup_required: { label: "Cleanup required", tone: "warning" },
  stale: { label: "Stale", tone: "stale" },
  missing: { label: "Missing", tone: "stale" },
  unmanaged: { label: "Unmanaged", tone: "ghost" },
  removed: { label: "Cleaned", tone: "neutral" },
} satisfies Record<WorkspaceState, WorkspaceStateDescriptor>;

/** `removed` is history, not work, so it is neither counted nor offered as a filter. */
export const WORKSPACE_COUNTED_STATES = [
  "active",
  "cleanup_required",
  "stale",
  "missing",
  "unmanaged",
] as const satisfies readonly WorkspaceState[];

export interface WorkspaceGitStateDescriptor {
  word: string;
  tone: StatusTone;
  detail: string;
}

export function workspaceGitState(
  present: boolean,
  dirty: boolean | null,
): WorkspaceGitStateDescriptor {
  if (!present) return { word: "gone", tone: "danger", detail: "the worktree is gone from disk" };
  if (dirty === null) {
    return { word: "unreadable", tone: "neutral", detail: "git could not read the worktree" };
  }
  if (dirty) {
    return { word: "dirty", tone: "warning", detail: "the worktree holds uncommitted changes" };
  }
  return { word: "clean", tone: "success", detail: "the worktree has no uncommitted change" };
}
