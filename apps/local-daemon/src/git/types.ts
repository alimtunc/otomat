export type WorktreeStatus = "active" | "archived" | "removed";

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "type_changed";

export interface ChangedFile {
  /** Current path (the new path for renames/copies). */
  path: string;
  /** Source path for renames/copies, else `null`. */
  oldPath: string | null;
  status: ChangeStatus;
  /** Added lines; always 0 for binary files. */
  additions: number;
  /** Removed lines; always 0 for binary files. */
  deletions: number;
  binary: boolean;
}

export interface DiffFile extends ChangedFile {
  /** Unified diff text for this file; empty when git emits no hunk. */
  patch: string;
  /** sha256 of `patch` — a stable per-file anchor for pin-to-SHA review. */
  sha: string;
}

export interface CanonicalDiff {
  /** Sha the diff is computed against (the worktree's fork point). */
  base: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
  /** sha256 of the full canonical patch — a stable identity for the whole diff. */
  sha: string;
}

/** A worktree as tracked by the service (mirrors a `worktrees` row). */
export interface WorktreeRecord {
  id: string;
  /** Exclusive owner token (e.g. step_run_id). */
  owner: string;
  repositoryId: string;
  path: string;
  branch: string;
  /** Recorded HEAD sha (the fork point at acquire; the final tip after archive). */
  headSha: string;
  status: WorktreeStatus;
}
