import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { acquireWorktree } from "./acquire.js";
import { diffInputs, worktreeGitView } from "./diff-inputs.js";
import { collectChangedFiles, computeCanonicalDiff, treeRangeSnapshot } from "./diff.js";
import { WorktreeConflictError, WorktreeNotFoundError } from "./errors.js";
import { toRecord } from "./record.js";
import { commitsSince, deleteBranch, fastForward, headSha, isAncestor, revParse } from "./repo.js";
import { boundarySnapshot, captureWorktreeState, commitScope } from "./scopes.js";
import type { GitWorktreeService, GitWorktreeServiceConfig } from "./service-contract.js";
import { readTreeFile } from "./tree-file.js";
import { pruneWorktrees, removeWorktree } from "./worktree-cli.js";
import { isDirty, snapshotSubject, snapshotWorktree } from "./worktree-snapshot.js";
import {
  findActiveByOwner,
  findLatestByOwner,
  listWorktreeRows,
  updateWorktreeStatus,
  type WorktreeRow,
} from "./worktrees-store.js";

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

  const scope = { repoRoot, defaultBranch };
  const acquireCtx = { db, repositoryId, repoRoot, defaultBranch, worktreesRoot, idFactory };

  return {
    acquire(input) {
      return acquireWorktree(acquireCtx, input);
    },

    get(owner) {
      const row = findActiveByOwner(db, owner);
      return row ? toRecord(row) : undefined;
    },

    list(filter = {}) {
      return listWorktreeRows(db, { repositoryId, status: filter.status }).map(toRecord);
    },

    changedFiles(owner) {
      const { gitCwd, base, tree } = diffInputs(scope, resolve(owner));
      return collectChangedFiles(gitCwd, base, tree);
    },

    diff(owner) {
      const { gitCwd, base, tree } = diffInputs(scope, resolve(owner));
      return computeCanonicalDiff(gitCwd, base, tree);
    },

    branchDiff(owner, against) {
      const inputs = diffInputs(scope, resolve(owner), against);
      return {
        branch: inputs.branch,
        baseRef: inputs.baseRef,
        snapshot: treeRangeSnapshot(inputs.gitCwd, inputs.base, inputs.tree),
      };
    },

    treeSnapshot(baseRef) {
      const tree = revParse(repoRoot, `${baseRef}^{tree}`);
      return { readFile: (path, limits) => readTreeFile(repoRoot, tree, path, limits) };
    },

    captureState(owner) {
      const row = findActiveByOwner(db, owner);
      if (!row) throw new WorktreeNotFoundError(owner);
      return captureWorktreeState(row.path);
    },

    boundaryDiff(startTree, endTree) {
      return boundarySnapshot(repoRoot, startTree, endTree);
    },

    commitScope(commit) {
      return commitScope(repoRoot, commit);
    },

    branchCommits(owner) {
      const { gitCwd, base, ref } = worktreeGitView(scope, resolve(owner));
      return commitsSince(gitCwd, base, ref);
    },

    commitDiff(owner, commit) {
      const { gitCwd, base } = worktreeGitView(scope, resolve(owner));
      return computeCanonicalDiff(gitCwd, base, revParse(gitCwd, `${commit}^{tree}`));
    },

    snapshot(owner, message = snapshotSubject("snapshot", owner)) {
      const row = findActiveByOwner(db, owner);
      if (!row) throw new WorktreeNotFoundError(owner);
      snapshotWorktree(row.path, message);
      const head = headSha(row.path);
      updateWorktreeStatus(db, row.id, { status: "active", head_sha: head });
      return toRecord({ ...row, head_sha: head });
    },

    promote(sourceOwner, canonicalOwner, expectedBaseSha) {
      const source = findActiveByOwner(db, sourceOwner);
      const canonical = findActiveByOwner(db, canonicalOwner);
      if (!source) throw new WorktreeNotFoundError(sourceOwner);
      if (!canonical) throw new WorktreeNotFoundError(canonicalOwner);

      snapshotWorktree(source.path, snapshotSubject("promote", sourceOwner));
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
        snapshotWorktree(row.path, snapshotSubject("archive", owner));
        head = headSha(row.path);
      } else {
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
