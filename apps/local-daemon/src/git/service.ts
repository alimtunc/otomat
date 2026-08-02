import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { collectChangedFiles, computeCanonicalDiff, worktreeStateTree } from "./diff.js";
import { WorktreeConflictError, WorktreeNotFoundError } from "./errors.js";
import { toRecord } from "./record.js";
import {
  branchExists,
  deleteBranch,
  fastForward,
  headSha,
  isAncestor,
  mergeBase,
  revParse,
} from "./repo.js";
import type { GitWorktreeService, GitWorktreeServiceConfig } from "./service-contract.js";
import { addWorktree, pruneWorktrees, removeWorktree } from "./worktree-cli.js";
import { isDirty, snapshotWorktree } from "./worktree-snapshot.js";
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

// A readable yet collision-free directory name: distinct owner tokens that
// sanitize to the same segment stay distinct via the raw-owner hash suffix.
function worktreeDirName(owner: string): string {
  const safe = owner.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64);
  const hash = createHash("sha256").update(owner).digest("hex").slice(0, 8);
  return `${safe}-${hash}`;
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
      // Rows written before fork points were recorded fall back to the default-branch merge base.
      const base =
        row.base_sha === ""
          ? (mergeBase(row.path, "HEAD", defaultBranch) ?? revParse(row.path, defaultBranch))
          : row.base_sha;
      return { gitCwd: row.path, base, tree: worktreeStateTree(row.path, base) };
    }
    const base =
      row.base_sha === ""
        ? (mergeBase(repoRoot, row.branch, defaultBranch) ?? revParse(repoRoot, defaultBranch))
        : row.base_sha;
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

      const baseRef = input.baseRef ?? defaultBranch;
      const baseSha = revParse(repoRoot, baseRef);
      mkdirSync(worktreesRoot, { recursive: true });
      try {
        addWorktree(repoRoot, { worktreePath: path, branch: input.branch, baseRef: baseSha });
      } catch (error) {
        // `git worktree add -b` creates the branch before the checkout, and a registered
        // worktree makes `git branch -D` refuse. Path-scoped: a repo-wide prune would
        // unregister a sound worktree whose directory is merely unreachable.
        removeWorktree(repoRoot, path);
        deleteBranch(repoRoot, input.branch);
        throw error;
      }

      const id = idFactory();
      try {
        insertWorktree(db, {
          id,
          repository_id: repositoryId,
          path,
          branch: input.branch,
          head_sha: baseSha,
          base_sha: baseSha,
          base_ref: baseRef,
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
        baseRef,
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

    snapshot(owner) {
      const row = findActiveByOwner(db, owner);
      if (!row) throw new WorktreeNotFoundError(owner);
      snapshotWorktree(row.path, `otomat: snapshot for ${owner}`);
      const head = headSha(row.path);
      updateWorktreeStatus(db, row.id, { status: "active", head_sha: head });
      return toRecord({ ...row, head_sha: head });
    },

    promote(sourceOwner, canonicalOwner, expectedBaseSha) {
      const source = findActiveByOwner(db, sourceOwner);
      const canonical = findActiveByOwner(db, canonicalOwner);
      if (!source) throw new WorktreeNotFoundError(sourceOwner);
      if (!canonical) throw new WorktreeNotFoundError(canonicalOwner);

      snapshotWorktree(source.path, `otomat: promote snapshot for ${sourceOwner}`);
      const sourceHead = headSha(source.path);
      updateWorktreeStatus(db, source.id, { status: "active", head_sha: sourceHead });

      if (!isAncestor(repoRoot, expectedBaseSha, sourceHead)) {
        throw new WorktreeConflictError(
          `candidate ${sourceOwner} does not descend from compete base ${expectedBaseSha}`,
        );
      }
      if (isDirty(canonical.path)) {
        throw new WorktreeConflictError(`canonical worktree ${canonicalOwner} is dirty`);
      }

      const canonicalHead = headSha(canonical.path);
      if (canonicalHead !== sourceHead) {
        if (canonicalHead !== expectedBaseSha) {
          throw new WorktreeConflictError(
            `canonical worktree ${canonicalOwner} moved after competitors forked`,
          );
        }
        fastForward(canonical.path, source.branch);
      }

      const promotedHead = headSha(canonical.path);
      updateWorktreeStatus(db, canonical.id, { status: "active", head_sha: promotedHead });
      return {
        source: toRecord({ ...source, head_sha: sourceHead }),
        canonical: toRecord({ ...canonical, head_sha: promotedHead }),
      };
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
