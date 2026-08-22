import { existsSync } from "node:fs";

import { worktreeStateTree } from "./diff.js";
import { mergeBase, revParse } from "./repo.js";
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
  ref: string;
}

export interface DiffInputs {
  gitCwd: string;
  base: string;
  tree: string;
}

function forkPoint(scope: DiffScope, row: WorktreeRow, gitCwd: string, ref: string): string {
  const baseRef = row.base_ref === "" ? scope.defaultBranch : row.base_ref;
  const merged = mergeBase(gitCwd, baseRef, ref);
  // Once the base branch contains `ref` the merge-base is `ref` itself, which would render the
  // cycle as an empty diff; the sha recorded at acquire is then the only fork point left.
  if (merged !== null && merged !== revParse(gitCwd, ref)) return merged;
  return row.base_sha === "" ? revParse(gitCwd, scope.defaultBranch) : row.base_sha;
}

export function worktreeGitView(scope: DiffScope, row: WorktreeRow): WorktreeGitView {
  const live = row.status === "active" && existsSync(row.path);
  const gitCwd = live ? row.path : scope.repoRoot;
  const ref = live ? "HEAD" : row.branch;
  return { live, gitCwd, base: forkPoint(scope, row, gitCwd, ref), ref };
}

/** A live worktree diffs its whole state, uncommitted work included; an archived one diffs its branch tip. */
export function diffInputs(scope: DiffScope, row: WorktreeRow): DiffInputs {
  const { live, gitCwd, base, ref } = worktreeGitView(scope, row);
  return {
    gitCwd,
    base,
    tree: live ? worktreeStateTree(gitCwd, base) : revParse(gitCwd, `${ref}^{tree}`),
  };
}
