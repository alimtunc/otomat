import type { Db } from "@otomat/db";

import type { CanonicalDiff, ChangedFile, WorktreeRecord, WorktreeStatus } from "./types.js";

export interface GitWorktreeServiceConfig {
  db: Db;
  /** `repositories.id` the worktrees belong to. */
  repositoryId: string;
  /** Main repository working tree (where `.git` lives). */
  repoRoot: string;
  /** Base branch worktrees fork from and diffs are computed against. */
  defaultBranch: string;
  /** Directory that holds worktree working dirs; kept outside `repoRoot`. */
  worktreesRoot: string;
  /** Override `worktrees.id` generation (tests). */
  idFactory?: () => string;
}

export interface AcquireWorktreeInput {
  /** Exclusive owner token (e.g. step_run_id). */
  owner: string;
  /** Dedicated branch to create for this worktree. */
  branch: string;
  /** Ref to fork from; defaults to the configured default branch. */
  baseRef?: string;
}

export interface CleanupOptions {
  /** Delete the dedicated branch too (default true). */
  deleteBranch?: boolean;
}

export interface WorktreeListFilter {
  status?: WorktreeStatus;
}

export interface WorktreePromotion {
  source: WorktreeRecord;
  canonical: WorktreeRecord;
}

export interface GitWorktreeService {
  /**
   * Forks a new worktree on a dedicated `branch` for `owner`. Idempotent when
   * `owner` already holds an active worktree on the same branch (returns it
   * unchanged). Creates the branch + checkout under `worktreesRoot` and records
   * a row with `headSha` pinned to the fork point. Throws WorktreeConflictError
   * when `owner` holds a different branch or the branch/path is already taken.
   */
  acquire(input: AcquireWorktreeInput): WorktreeRecord;
  /** The owner's active worktree, or `undefined`; archived/removed rows are ignored. */
  get(owner: string): WorktreeRecord | undefined;
  /** Records for the configured repository, newest first; optionally filtered by `status`. */
  list(filter?: WorktreeListFilter): WorktreeRecord[];
  /**
   * Per-file changes of the owner's worktree against its fork point. Resolves
   * the active worktree, else the latest non-removed one; throws
   * WorktreeNotFoundError when neither exists.
   */
  changedFiles(owner: string): ChangedFile[];
  /**
   * Canonical diff of the owner's worktree against its fork point. Resolves the
   * active worktree, else the latest non-removed one; throws
   * WorktreeNotFoundError when neither exists.
   */
  diff(owner: string): CanonicalDiff;
  /** Commits outstanding changes and records the new branch tip without removing the active worktree. */
  snapshot(owner: string): WorktreeRecord;
  /** Fast-forwards the clean canonical owner from one candidate forked at `expectedBaseSha`. */
  promote(sourceOwner: string, canonicalOwner: string, expectedBaseSha: string): WorktreePromotion;
  /**
   * Commits any uncommitted work, removes the working directory, and marks the
   * row archived with the branch tip as `headSha`; the branch is kept. Requires
   * an active worktree — throws WorktreeNotFoundError otherwise. Converges even
   * when the working directory has vanished by reading the branch tip.
   */
  archive(owner: string): WorktreeRecord;
  /**
   * Removes the working directory and marks the row removed, deleting the branch
   * unless `deleteBranch` is false. Tolerant of an already-removed directory.
   * Throws WorktreeNotFoundError when no active or archived worktree is tracked.
   */
  cleanup(owner: string, options?: CleanupOptions): void;
}
