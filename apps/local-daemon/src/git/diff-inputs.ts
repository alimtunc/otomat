import { worktreeStateTree } from "./diff.js";
import { mergeBase, revParse } from "./repo.js";
import type { WorktreeRow } from "./worktrees-store.js";

export interface DiffScope {
  /** Main working tree, which is where an archived worktree's branch is read from. */
  repoRoot: string;
  defaultBranch: string;
}

export interface DiffBase {
  gitCwd: string;
  base: string;
}

export interface DiffInputs extends DiffBase {
  tree: string;
}

export function diffBase(scope: DiffScope, row: WorktreeRow): DiffBase {
  const gitCwd = row.status === "active" ? row.path : scope.repoRoot;
  const forkPoint = row.status === "active" ? "HEAD" : row.branch;
  const base =
    row.base_sha === ""
      ? (mergeBase(gitCwd, forkPoint, scope.defaultBranch) ?? revParse(gitCwd, scope.defaultBranch))
      : row.base_sha;
  return { gitCwd, base };
}

/** A live worktree diffs its whole state, uncommitted work included; an archived one diffs its branch tip. */
export function diffInputs(scope: DiffScope, row: WorktreeRow): DiffInputs {
  const { gitCwd, base } = diffBase(scope, row);
  const tree =
    row.status === "active"
      ? worktreeStateTree(gitCwd, base)
      : revParse(gitCwd, `${row.branch}^{tree}`);
  return { gitCwd, base, tree };
}
