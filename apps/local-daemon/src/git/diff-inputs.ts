import { existsSync } from "node:fs";

import { worktreeStateTree } from "./diff.js";
import { baseBranchForkPoint, isAncestor, revParse } from "./repo.js";
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

async function forkBase(
  scope: DiffScope,
  row: WorktreeRow,
  gitCwd: string,
  ref: string,
  against: string | undefined,
) {
  const baseRef = against ?? (row.base_ref === "" ? scope.defaultBranch : row.base_ref);
  const merged = await baseBranchForkPoint(gitCwd, baseRef, ref);
  // Once the base branch contains `ref` the merge-base is `ref` itself, which would render the
  // cycle as an empty diff; the sha recorded at acquire is then the only fork point left.
  if (merged === null || merged === (await revParse(gitCwd, ref))) {
    return {
      baseRef,
      base: row.base_sha === "" ? await revParse(gitCwd, scope.defaultBranch) : row.base_sha,
    };
  }
  // The recorded sha is the only fork point left when git can name no published side of the base branch.
  const behindRecorded =
    row.base_sha !== "" &&
    merged !== row.base_sha &&
    (await isAncestor(gitCwd, merged, row.base_sha)) &&
    (await isAncestor(gitCwd, row.base_sha, ref));
  return { baseRef, base: against === undefined && behindRecorded ? row.base_sha : merged };
}

export async function worktreeGitView(
  scope: DiffScope,
  row: WorktreeRow,
  against?: string,
): Promise<WorktreeGitView> {
  const live = row.status === "active" && existsSync(row.path);
  const gitCwd = live ? row.path : scope.repoRoot;
  const ref = live ? "HEAD" : row.branch;
  return {
    live,
    gitCwd,
    ...(await forkBase(scope, row, gitCwd, ref, against)),
    ref,
    branch: row.branch,
  };
}

/** A live worktree diffs its whole state, uncommitted work included; an archived one diffs its branch tip. */
export async function diffInputs(
  scope: DiffScope,
  row: WorktreeRow,
  against?: string,
): Promise<DiffInputs> {
  const view = await worktreeGitView(scope, row, against);
  return {
    ...view,
    tree: view.live
      ? await worktreeStateTree(view.gitCwd, view.base)
      : await revParse(view.gitCwd, `${view.ref}^{tree}`),
  };
}
