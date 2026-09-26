import { getPullRequestForRun, getRun } from "@otomat/db";
import type { ComparedWorkspaceFreshness, WorkspaceFreshness } from "@otomat/domain";

import {
  compareWithRemote,
  fetchRemoteTips,
  inCheckout,
  RemoteBaseError,
  uncommittedPaths,
  type RemoteTips,
} from "#git";

import type { SupervisorState } from "../state.js";
import { requireOpenWorkspace, RunWorkspaceClosedError } from "../workspace.js";

export interface FreshnessTarget {
  path: string;
  branch: string;
  baseRef: string;
}

export function freshnessTarget(state: SupervisorState, runId: string): FreshnessTarget {
  const run = getRun(state.db, runId);
  if (!run) throw new RunWorkspaceClosedError(`run ${runId} not found`);
  requireOpenWorkspace(state.db, run);
  const binding = state.repositories.forRepository(run.repository_id);
  const worktree = binding?.service.get(runId);
  if (!binding || !worktree) {
    throw new RunWorkspaceClosedError(`run ${runId} worktree is unavailable`);
  }
  return {
    path: worktree.path,
    branch: worktree.branch,
    // The pull request's target is where the work lands; before one exists, the branch it forked from.
    baseRef:
      getPullRequestForRun(state.db, runId)?.base_ref || worktree.baseRef || binding.defaultBranch,
  };
}

function freshnessState({
  branch,
  base,
}: Pick<ComparedWorkspaceFreshness, "branch" | "base">): ComparedWorkspaceFreshness["state"] {
  if (branch !== null && branch.behind > 0) return branch.ahead > 0 ? "diverged" : "behind";
  return base !== null && base.behind > 0 ? "behind" : "up_to_date";
}

/** Reads HEAD and the index, so the caller holds the checkout. */
export async function compareFreshness(
  path: string,
  tips: RemoteTips,
): Promise<ComparedWorkspaceFreshness> {
  const comparisons = await compareWithRemote(path, tips);
  return {
    state: freshnessState(comparisons),
    ...comparisons,
    dirty: (await uncommittedPaths(path)).length > 0,
  };
}

export async function readWorkspaceFreshness(
  state: SupervisorState,
  runId: string,
): Promise<WorkspaceFreshness> {
  const target = freshnessTarget(state, runId);
  let tips: RemoteTips;
  try {
    tips = await fetchRemoteTips(target.path, target.branch, target.baseRef);
  } catch (error) {
    if (!(error instanceof RemoteBaseError)) throw error;
    return { state: "unverifiable", failure: { message: error.message, remote: error.remote } };
  }
  return inCheckout(target.path, () => compareFreshness(target.path, tips));
}
