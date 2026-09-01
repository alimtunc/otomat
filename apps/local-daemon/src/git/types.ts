import type { WorktreeStatus } from "@otomat/db";
import type { ChangeStatus } from "@otomat/domain";

export type { ChangeStatus, WorktreeStatus };

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

/** Renames and copies read their base side from `oldPath`, not from `path`. */
export type DiffFilePaths = Pick<ChangedFile, "path" | "oldPath">;

export interface DiffFileBlobs {
  base: string | null;
  head: string | null;
}

export interface CanonicalDiff {
  base: string;
  head: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
  /** sha256 of the full canonical patch — a stable identity for the whole diff. */
  sha: string;
}

export interface WorktreeStateCapture {
  treeSha: string;
  headSha: string;
}

/** A worktree as tracked by the service (mirrors a `worktrees` row). */
export interface WorktreeRecord {
  id: string;
  /** Exclusive owner token (e.g. step_run_id). */
  owner: string;
  repositoryId: string;
  path: string;
  branch: string;
  /** Recorded HEAD sha (the fork point at acquire; the latest snapshot/archive tip afterward). */
  headSha: string;
  /** Branch this worktree forked from; `""` on rows recorded before fork refs were tracked. */
  baseRef: string;
  status: WorktreeStatus;
}
