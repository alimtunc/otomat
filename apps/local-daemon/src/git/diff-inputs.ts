import { existsSync } from "node:fs";

import { worktreeStateTree } from "./diff.js";
import { isAncestor, mergeBase, revParse } from "./repo.js";
import type { WorktreeRow } from "./worktrees-store.js";

export interface DiffScope {
  /** Main working tree, which is where an archived worktree's branch is read from. */
  repoRoot: string;
  defaultBranch: string;
}

export interface WorktreeGitView {
  /** An active row can outlive its working directory, and then answers from the main repository. */
  live: boolean;
  gitCwd: string;
  base: string;
  baseRef: string;
  ref: string;
  /** Branch the worktree carries, even when it answers from the main repository. */
  branch: string;
}

export interface DiffInputs extends WorktreeGitView {
  tree: string;
}

function forkBase(
  scope: DiffScope,
  row: WorktreeRow,
  gitCwd: string,
  ref: string,
  against: string | undefined,
) {
  const baseRef = against ?? (row.base_ref === "" ? scope.defaultBranch : row.base_ref);
  const merged = mergeBase(gitCwd, baseRef, ref);
  // Once the base branch contains `ref` the merge-base is `ref` itself, which would render the
  // cycle as an empty diff; the sha recorded at acquire is then the only fork point left.
  if (merged === null || merged === revParse(gitCwd, ref)) {
    return {
      baseRef,
      base: row.base_sha === "" ? revParse(gitCwd, scope.defaultBranch) : row.base_sha,
    };
  }
  // A base branch still missing the fetched remote head reports a fork point behind the recorded one.
  const behindRecorded =
    row.base_sha !== "" &&
    merged !== row.base_sha &&
    isAncestor(gitCwd, merged, row.base_sha) &&
    isAncestor(gitCwd, row.base_sha, ref);
  return { baseRef, base: against === undefined && behindRecorded ? row.base_sha : merged };
}

export function worktreeGitView(
  scope: DiffScope,
  row: WorktreeRow,
  against?: string,
): WorktreeGitView {
  const live = row.status === "active" && existsSync(row.path);
  const gitCwd = live ? row.path : scope.repoRoot;
  const ref = live ? "HEAD" : row.branch;
  return {
    live,
    gitCwd,
    ...forkBase(scope, row, gitCwd, ref, against),
    ref,
    branch: row.branch,
  };
}

/** A live worktree diffs its whole state, uncommitted work included; an archived one diffs its branch tip. */
export function diffInputs(scope: DiffScope, row: WorktreeRow, against?: string): DiffInputs {
  const view = worktreeGitView(scope, row, against);
  return {
    ...view,
    tree: view.live
      ? worktreeStateTree(view.gitCwd, view.base)
      : revParse(view.gitCwd, `${view.ref}^{tree}`),
  };
}
