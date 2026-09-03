import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { WorktreeConflictError } from "./errors.js";
import { toRecord } from "./record.js";
import { branchExists, deleteBranch, revParse } from "./repo.js";
import type { AcquireWorktreeInput, GitWorktreeServiceConfig } from "./service-contract.js";
import type { WorktreeRecord } from "./types.js";
import { addWorktree, pruneWorktrees, removeWorktree } from "./worktree-cli.js";
import {
  findActiveByBranch,
  findActiveByOwner,
  findActiveByPath,
  insertWorktree,
} from "./worktrees-store.js";

// The hash suffix keeps distinct owners apart when their names sanitize to the same segment.
function worktreeDirName(owner: string): string {
  const safe = owner.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64);
  const hash = createHash("sha256").update(owner).digest("hex").slice(0, 8);
  return `${safe}-${hash}`;
}

export type AcquireContext = GitWorktreeServiceConfig & { idFactory: () => string };

/** Forks a worktree on a dedicated branch, or returns the owner's existing one when it already holds that branch. */
export function acquireWorktree(ctx: AcquireContext, input: AcquireWorktreeInput): WorktreeRecord {
  const { db, repoRoot } = ctx;
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

  const path = join(ctx.worktreesRoot, worktreeDirName(input.owner));
  if (findActiveByPath(db, path)) {
    throw new WorktreeConflictError(`worktree path ${path} is already in use`);
  }

  const baseRef = input.baseRef ?? ctx.defaultBranch;
  const baseSha = input.baseSha ?? revParse(repoRoot, baseRef);
  mkdirSync(ctx.worktreesRoot, { recursive: true });
  try {
    addWorktree(repoRoot, { worktreePath: path, branch: input.branch, baseRef: baseSha });
  } catch (error) {
    // `git worktree add -b` creates the branch before the checkout, and a registered worktree
    // makes `git branch -D` refuse; the prune stays path-scoped to spare unreachable siblings.
    removeWorktree(repoRoot, path, { force: true });
    deleteBranch(repoRoot, input.branch);
    throw error;
  }

  const id = ctx.idFactory();
  try {
    insertWorktree(db, {
      id,
      repository_id: ctx.repositoryId,
      path,
      branch: input.branch,
      head_sha: baseSha,
      base_sha: baseSha,
      base_ref: baseRef,
      owner_token: input.owner,
      status: "active",
    });
  } catch (error) {
    removeWorktree(repoRoot, path, { force: true });
    deleteBranch(repoRoot, input.branch);
    pruneWorktrees(repoRoot);
    throw error;
  }

  return {
    id,
    owner: input.owner,
    repositoryId: ctx.repositoryId,
    path,
    branch: input.branch,
    headSha: baseSha,
    baseRef,
    status: "active",
  };
}
