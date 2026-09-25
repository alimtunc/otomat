import type { Db } from "@otomat/db";
import type { CommitFilesRequest, CommitFilesResponse, WorktreeFileEntry } from "@otomat/domain";

import { WorktreeNotFoundError } from "./errors.js";
import type { CommitSummary } from "./repo.js";
import type { TreeFileLimits, TreeFileRead } from "./tree-file.js";
import type {
  CanonicalDiff,
  ChangedFile,
  DiffFileBlobs,
  DiffFileMediaBlobs,
  DiffFilePaths,
  WorktreeRecord,
  WorktreeStateCapture,
  WorktreeStatus,
} from "./types.js";

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
  preparedIssueId?: string;
  /** Exclusive owner token (e.g. step_run_id). */
  owner: string;
  /** Dedicated branch to create for this worktree. */
  branch: string;
  /** Ref to fork from; defaults to the configured default branch. */
  baseRef?: string;
  /** Absent resolves `baseRef` at acquire time. */
  baseSha?: string;
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

/** One captured tree, so every path a response quotes comes from the same instant of the repository. */
export interface TreeSnapshot {
  readFile(path: string, limits: TreeFileLimits): Promise<TreeFileRead>;
}

export interface DiffSnapshot extends TreeSnapshot {
  diff: CanonicalDiff;
  /** Whole-file text on both sides of `diff`, read from the captured base and tree. */
  fileBlobs(paths: DiffFilePaths): Promise<DiffFileBlobs>;
  mediaBlobs(paths: DiffFilePaths): Promise<DiffFileMediaBlobs>;
}

/** The owner's worktree as one captured tree: entries, reads and the blob behind a media file all come from the same instant. */
export interface WorktreeTree extends TreeSnapshot {
  /** Live worktree directory a save writes into; null once only the archived branch tip remains. */
  worktreePath: string | null;
  entries(): Promise<WorktreeFileEntry[]>;
  readBlob(oid: string): Promise<Buffer>;
}

export interface BranchDiff {
  branch: string;
  baseRef: string;
  snapshot: DiffSnapshot;
}

/** One commit resolved into what it actually changed; `parent` is null on a root commit, diffed against the empty tree. */
export interface CommitScope {
  commit: CommitSummary;
  parent: string | null;
  snapshot: DiffSnapshot;
}

export interface GitWorktreeService {
  /**
   * Forks a new worktree on a dedicated `branch` for `owner`. Idempotent when
   * `owner` already holds an active worktree on the same branch (returns it
   * unchanged). Creates the branch + checkout under `worktreesRoot` and records
   * a row with `headSha` pinned to the fork point. Throws WorktreeConflictError
   * when `owner` holds a different branch or the branch/path is already taken.
   */
  acquire(input: AcquireWorktreeInput): Promise<WorktreeRecord>;
  /** The owner's active worktree, or `undefined`; archived/removed rows are ignored. */
  get(owner: string): WorktreeRecord | undefined;
  /** Records for the configured repository, newest first; optionally filtered by `status`. */
  list(filter?: WorktreeListFilter): WorktreeRecord[];
  /**
   * Per-file changes of the owner's worktree against its fork point. Resolves
   * the active worktree, else the latest non-removed one; throws
   * WorktreeNotFoundError when neither exists.
   */
  changedFiles(owner: string): Promise<ChangedFile[]>;
  /**
   * Canonical diff of the owner's worktree against its fork point. Resolves the
   * active worktree, else the latest non-removed one; throws
   * WorktreeNotFoundError when neither exists.
   */
  diff(owner: string): Promise<CanonicalDiff>;
  /**
   * The diff plus whole-file reads captured from one `{base, tree}` pair, so
   * expanded content always matches the diff it is served with even while the
   * worktree keeps changing. `against` overrides the fork base — a pull
   * request's target branch. Resolves like `diff`.
   */
  branchDiff(owner: string, against?: string): Promise<BranchDiff>;
  /** A tree captured from a ref rather than from a worktree: what a launch reads before its worktree exists. */
  treeSnapshot(baseRef: string): Promise<TreeSnapshot>;
  /** The same tree `diff` reads its head from, so a file opened here is the file the diff shows. Resolves like `diff`. */
  worktreeTree(owner: string): Promise<WorktreeTree>;
  /** Requires an active worktree; the tree it writes covers staged, unstaged and untracked work alike. */
  captureState(owner: string): Promise<WorktreeStateCapture>;
  /** Read from the repository, so a removed worktree does not lose the delta. */
  boundaryDiff(startTree: string, endTree: string): Promise<DiffSnapshot | null>;
  commitScope(commit: string): Promise<CommitScope | null>;
  /** Commits the owner's branch carries above its fork point, newest first. */
  branchCommits(owner: string): Promise<CommitSummary[]>;
  /** Canonical diff of `commit` against the owner's fork point: only a commit can stand for what a push published. */
  commitDiff(owner: string, commit: string): Promise<CanonicalDiff>;
  /** Commits outstanding changes and records the new branch tip without removing the active worktree. `message` names a commit a reader will see; the default is the internal snapshot. */
  snapshot(owner: string, message?: string): Promise<WorktreeRecord>;
  commitStaged(owner: string, request: CommitFilesRequest): Promise<CommitFilesResponse>;
  /** Fast-forwards the clean canonical owner from one candidate forked at `expectedBaseSha`. */
  promote(
    sourceOwner: string,
    canonicalOwner: string,
    expectedBaseSha: string,
  ): Promise<WorktreePromotion>;
  /**
   * Commits any uncommitted work, removes the working directory, and marks the
   * row archived with the branch tip as `headSha`; the branch is kept. Requires
   * an active worktree — throws WorktreeNotFoundError otherwise. Converges even
   * when the working directory has vanished by reading the branch tip.
   */
  archive(owner: string): Promise<WorktreeRecord>;
  /**
   * Removes the working directory and marks the row removed, deleting the branch
   * unless `deleteBranch` is false. Tolerant of an already-removed directory.
   * Throws WorktreeNotFoundError when no active or archived worktree is tracked.
   */
  cleanup(owner: string, options?: CleanupOptions): Promise<void>;
}

/** The owner's canonical diff, or null when its worktree is gone; any other git failure propagates. */
export async function diffOrNull(
  service: GitWorktreeService,
  owner: string,
): Promise<CanonicalDiff | null> {
  try {
    return await service.diff(owner);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

/** The owner's branch diff, or null when its worktree is gone; any other git failure propagates. */
export async function branchDiffOrNull(
  service: GitWorktreeService,
  owner: string,
  against?: string,
): Promise<BranchDiff | null> {
  try {
    return await service.branchDiff(owner, against);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

export async function worktreeTreeOrNull(
  service: GitWorktreeService,
  owner: string,
): Promise<WorktreeTree | null> {
  try {
    return await service.worktreeTree(owner);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

export async function diffSnapshotOrNull(
  service: GitWorktreeService,
  owner: string,
  against?: string,
): Promise<DiffSnapshot | null> {
  return (await branchDiffOrNull(service, owner, against))?.snapshot ?? null;
}
