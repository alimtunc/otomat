import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { acquireWorktree } from "./acquire.js";
import { deleteBranch } from "./branches.js";
import { diffInputs, worktreeGitView } from "./diff-inputs.js";
import { collectChangedFiles, computeCanonicalDiff, treeRangeSnapshot } from "./diff.js";
import { WorktreeConflictError, WorktreeNotFoundError } from "./errors.js";
import { inCheckout } from "./lock.js";
import { toRecord } from "./record.js";
import { commitsSince, fastForward, headSha, isAncestor, revParse } from "./repo.js";
import { boundarySnapshot, captureWorktreeState, commitScope } from "./scopes.js";
import type { GitWorktreeService, GitWorktreeServiceConfig } from "./service-contract.js";
import { commitCheckoutFiles } from "./source-control/commit.js";
import { listTreeFiles, readTreeBlob, readTreeFile } from "./tree-file.js";
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

  function requireActive(owner: string): WorktreeRow {
    const row = findActiveByOwner(db, owner);
    if (!row) throw new WorktreeNotFoundError(owner);
    return row;
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

    async changedFiles(owner) {
      const { gitCwd, base, tree } = await diffInputs(scope, resolve(owner));
      return collectChangedFiles(gitCwd, base, tree);
    },

    async diff(owner) {
      const { gitCwd, base, tree } = await diffInputs(scope, resolve(owner));
      return computeCanonicalDiff(gitCwd, base, tree);
    },

    async branchDiff(owner, against) {
      const inputs = await diffInputs(scope, resolve(owner), against);
      return {
        branch: inputs.branch,
        baseRef: inputs.baseRef,
        snapshot: await treeRangeSnapshot(inputs.gitCwd, inputs.base, inputs.tree),
      };
    },

    async treeSnapshot(baseRef) {
      const tree = await revParse(repoRoot, `${baseRef}^{tree}`);
      return { readFile: (path, limits) => readTreeFile(repoRoot, tree, path, limits) };
    },

    async worktreeTree(owner) {
      const { gitCwd, tree, live } = await diffInputs(scope, resolve(owner));
      return {
        worktreePath: live ? gitCwd : null,
        entries: () => listTreeFiles(gitCwd, tree),
        readFile: (path, limits) => readTreeFile(gitCwd, tree, path, limits),
        readBlob: (oid) => readTreeBlob(gitCwd, oid),
      };
    },

    async captureState(owner) {
      const row = requireActive(owner);
      return captureWorktreeState(row.path);
    },

    boundaryDiff(startTree, endTree) {
      return boundarySnapshot(repoRoot, startTree, endTree);
    },

    commitScope(commit) {
      return commitScope(repoRoot, commit);
    },

    async branchCommits(owner) {
      const { gitCwd, base, ref } = await worktreeGitView(scope, resolve(owner));
      return commitsSince(gitCwd, base, ref);
    },

    async commitDiff(owner, commit) {
      const { gitCwd, base } = await worktreeGitView(scope, resolve(owner));
      return computeCanonicalDiff(gitCwd, base, await revParse(gitCwd, `${commit}^{tree}`));
    },

    async snapshot(owner, message = snapshotSubject("snapshot", owner)) {
      const row = requireActive(owner);
      return inCheckout(row.path, async () => {
        await snapshotWorktree(row.path, message);
        const head = await headSha(row.path);
        updateWorktreeStatus(db, row.id, { status: "active", head_sha: head });
        return toRecord({ ...row, head_sha: head });
      });
    },

    async commitStaged(owner, request) {
      const row = requireActive(owner);
      const result = await commitCheckoutFiles(row.path, request);
      updateWorktreeStatus(db, row.id, { status: "active", head_sha: result.sha });
      return result;
    },

    async promote(sourceOwner, canonicalOwner, expectedBaseSha) {
      const source = requireActive(sourceOwner);
      const canonical = requireActive(canonicalOwner);

      const sourceHead = await inCheckout(source.path, async () => {
        await snapshotWorktree(source.path, snapshotSubject("promote", sourceOwner));
        const head = await headSha(source.path);
        updateWorktreeStatus(db, source.id, { status: "active", head_sha: head });
        return head;
      });

      if (!(await isAncestor(repoRoot, expectedBaseSha, sourceHead))) {
        throw new WorktreeConflictError(
          `candidate ${sourceOwner} does not descend from compete base ${expectedBaseSha}`,
        );
      }

      const promotedHead = await inCheckout(canonical.path, async () => {
        if (await isDirty(canonical.path)) {
          throw new WorktreeConflictError(`canonical worktree ${canonicalOwner} is dirty`);
        }
        const canonicalHead = await headSha(canonical.path);
        if (canonicalHead !== sourceHead) {
          if (canonicalHead !== expectedBaseSha) {
            throw new WorktreeConflictError(
              `canonical worktree ${canonicalOwner} moved after competitors forked`,
            );
          }
          await fastForward(canonical.path, source.branch);
        }
        const head = await headSha(canonical.path);
        updateWorktreeStatus(db, canonical.id, { status: "active", head_sha: head });
        return head;
      });
      return {
        source: toRecord({ ...source, head_sha: sourceHead }),
        canonical: toRecord({ ...canonical, head_sha: promotedHead }),
      };
    },

    async archive(owner) {
      const row = requireActive(owner);
      return inCheckout(row.path, async () => {
        let head: string;
        if (existsSync(row.path)) {
          await snapshotWorktree(row.path, snapshotSubject("archive", owner));
          head = await headSha(row.path);
        } else {
          head = await revParse(repoRoot, row.branch);
        }
        await removeWorktree(repoRoot, row.path, { force: true });
        await pruneWorktrees(repoRoot);
        updateWorktreeStatus(db, row.id, { status: "archived", head_sha: head });
        return toRecord({ ...row, status: "archived", head_sha: head });
      });
    },

    async cleanup(owner, options = {}) {
      const row = resolve(owner);
      return inCheckout(row.path, async () => {
        await removeWorktree(repoRoot, row.path, { force: true });
        await pruneWorktrees(repoRoot);
        if (options.deleteBranch ?? true) await deleteBranch(repoRoot, row.branch);
        updateWorktreeStatus(db, row.id, { status: "removed" });
      });
    },
  };
}
