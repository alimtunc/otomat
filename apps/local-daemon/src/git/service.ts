import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Db } from "@otomat/db";

import { collectChangedFiles, computeCanonicalDiff, worktreeStateTree } from "./diff.js";
import { WorktreeConflictError, WorktreeNotFoundError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { branchExists, deleteBranch, headSha, mergeBase, revParse } from "./repo.js";
import type { CanonicalDiff, ChangedFile, WorktreeRecord, WorktreeStatus } from "./types.js";
import { addWorktree, pruneWorktrees, removeWorktree } from "./worktree-cli.js";
import {
  findActiveByBranch,
  findActiveByOwner,
  findActiveByPath,
  findLatestByOwner,
  insertWorktree,
  listWorktreeRows,
  updateWorktreeStatus,
  type WorktreeRow,
} from "./worktrees-store.js";

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

const OTOMAT_IDENTITY = {
  GIT_AUTHOR_NAME: "Otomat",
  GIT_AUTHOR_EMAIL: "otomat@local",
  GIT_COMMITTER_NAME: "Otomat",
  GIT_COMMITTER_EMAIL: "otomat@local",
} as const;

// A readable yet collision-free directory name: distinct owner tokens that
// sanitize to the same segment stay distinct via the raw-owner hash suffix.
function worktreeDirName(owner: string): string {
  const safe = owner.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64);
  const hash = createHash("sha256").update(owner).digest("hex").slice(0, 8);
  return `${safe}-${hash}`;
}

function toRecord(row: WorktreeRow): WorktreeRecord {
  return {
    id: row.id,
    owner: row.owner_token ?? "",
    repositoryId: row.repository_id,
    path: row.path,
    branch: row.branch,
    headSha: row.head_sha ?? "",
    status: row.status as WorktreeStatus,
  };
}

function isDirty(cwd: string): boolean {
  return runGit(["status", "--porcelain"], { cwd }).stdout.trim() !== "";
}

function hasGitIdentity(cwd: string): boolean {
  const res = runGit(["config", "--get", "user.email"], { cwd, allowFailure: true });
  return res.exitCode === 0 && res.stdout.trim() !== "";
}

/** Commits the worktree's current state so an archived branch keeps the work. */
function snapshotWorktree(cwd: string, message: string): void {
  if (!isDirty(cwd)) return;
  runGit(["add", "-A"], { cwd });
  const env = hasGitIdentity(cwd) ? undefined : OTOMAT_IDENTITY;
  runGit(["-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message], { cwd, env });
}

/**
 * Builds the worktree/branch lifecycle service over `config.db` and the repo at
 * `config.repoRoot`. One active worktree per owner is enforced by the
 * `worktrees` partial unique index; diffs resolve against each worktree's fork
 * point (merge-base with the default branch), while archives snapshot
 * uncommitted work and pin the branch tip as `headSha`.
 */
export function createGitWorktreeService(config: GitWorktreeServiceConfig): GitWorktreeService {
  const { db, repositoryId, repoRoot, defaultBranch, worktreesRoot } = config;
  const idFactory = config.idFactory ?? randomUUID;

  function resolve(owner: string): WorktreeRow {
    const active = findActiveByOwner(db, owner);
    if (active) return active;
    const latest = findLatestByOwner(db, owner);
    if (latest && latest.status !== "removed") return latest;
    throw new WorktreeNotFoundError(owner);
  }

  function diffInputs(row: WorktreeRow): { gitCwd: string; base: string; tree: string } {
    if (row.status === "active") {
      const base = mergeBase(row.path, "HEAD", defaultBranch) ?? revParse(row.path, defaultBranch);
      return { gitCwd: row.path, base, tree: worktreeStateTree(row.path, base) };
    }
    const base =
      mergeBase(repoRoot, row.branch, defaultBranch) ?? revParse(repoRoot, defaultBranch);
    return { gitCwd: repoRoot, base, tree: revParse(repoRoot, `${row.branch}^{tree}`) };
  }

  return {
    acquire(input) {
      const existing = findActiveByOwner(db, input.owner);
      if (existing) {
        if (existing.branch !== input.branch) {
          throw new WorktreeConflictError(
            `owner ${input.owner} already holds an active worktree on branch ${existing.branch}`,
          );
        }
        return toRecord(existing);
      }

      const branchHolder = findActiveByBranch(db, input.branch);
      if (branchHolder) {
        throw new WorktreeConflictError(
          `branch ${input.branch} is already held by worktree ${branchHolder.id}`,
        );
      }
      if (branchExists(repoRoot, input.branch)) {
        throw new WorktreeConflictError(`branch ${input.branch} already exists in the repository`);
      }

      const path = join(worktreesRoot, worktreeDirName(input.owner));
      if (findActiveByPath(db, path)) {
        throw new WorktreeConflictError(`worktree path ${path} is already in use`);
      }

      const baseSha = revParse(repoRoot, input.baseRef ?? defaultBranch);
      mkdirSync(worktreesRoot, { recursive: true });
      addWorktree(repoRoot, { worktreePath: path, branch: input.branch, baseRef: baseSha });

      const id = idFactory();
      try {
        insertWorktree(db, {
          id,
          repository_id: repositoryId,
          path,
          branch: input.branch,
          head_sha: baseSha,
          owner_token: input.owner,
          status: "active",
        });
      } catch (error) {
        // The partial unique index rejected a duplicate active owner; undo the git
        // side fully — the working dir AND the branch `addWorktree -b` just created.
        removeWorktree(repoRoot, path);
        deleteBranch(repoRoot, input.branch);
        pruneWorktrees(repoRoot);
        throw error;
      }

      return {
        id,
        owner: input.owner,
        repositoryId,
        path,
        branch: input.branch,
        headSha: baseSha,
        status: "active",
      };
    },

    get(owner) {
      const row = findActiveByOwner(db, owner);
      return row ? toRecord(row) : undefined;
    },

    list(filter = {}) {
      return listWorktreeRows(db, { repositoryId, status: filter.status }).map(toRecord);
    },

    changedFiles(owner) {
      const { gitCwd, base, tree } = diffInputs(resolve(owner));
      return collectChangedFiles(gitCwd, base, tree);
    },

    diff(owner) {
      const { gitCwd, base, tree } = diffInputs(resolve(owner));
      return computeCanonicalDiff(gitCwd, base, tree);
    },

    archive(owner) {
      const row = findActiveByOwner(db, owner);
      if (!row) throw new WorktreeNotFoundError(owner);

      let head: string;
      if (existsSync(row.path)) {
        snapshotWorktree(row.path, `otomat: archive snapshot for ${owner}`);
        head = headSha(row.path);
      } else {
        // Working dir vanished (crash/manual rm): converge anyway from the branch tip.
        head = revParse(repoRoot, row.branch);
      }
      removeWorktree(repoRoot, row.path);
      pruneWorktrees(repoRoot);
      updateWorktreeStatus(db, row.id, { status: "archived", head_sha: head });

      return toRecord({ ...row, status: "archived", head_sha: head });
    },

    cleanup(owner, options = {}) {
      const row = resolve(owner);
      removeWorktree(repoRoot, row.path);
      pruneWorktrees(repoRoot);
      if (options.deleteBranch ?? true) deleteBranch(repoRoot, row.branch);
      updateWorktreeStatus(db, row.id, { status: "removed" });
    },
  };
}
