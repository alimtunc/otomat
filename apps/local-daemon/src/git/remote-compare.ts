import type {
  ComparedWorkspaceFreshness,
  RemoteRefComparison,
  WorkspaceUpdateStrategy,
} from "@otomat/domain";

import { RemoteBaseError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { fetchRemoteTip, type RemoteTip } from "./remote-base.js";

export interface RemoteTips {
  branch: RemoteTip | null;
  base: RemoteTip | null;
}

type Divergence = Omit<RemoteRefComparison, "strategies">;

/** A branch with no upstream counts as unpublished, so only reading the base can make the check fail. */
async function publishedTip(worktreePath: string, branch: string): Promise<RemoteTip | null> {
  try {
    return await fetchRemoteTip(worktreePath, branch);
  } catch (error) {
    if (error instanceof RemoteBaseError && error.remote.failure === "no_upstream") return null;
    throw error;
  }
}

export async function fetchRemoteTips(
  worktreePath: string,
  branch: string,
  baseRef: string,
): Promise<RemoteTips> {
  return {
    branch: await publishedTip(worktreePath, branch),
    base: await fetchRemoteTip(worktreePath, baseRef),
  };
}

async function divergence(worktreePath: string, tip: RemoteTip): Promise<Divergence> {
  const { stdout } = await runGit(["rev-list", "--left-right", "--count", `HEAD...${tip.sha}`], {
    cwd: worktreePath,
  });
  const [ahead, behind] = stdout.trim().split(/\s+/).map(Number);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    throw new Error(`unreadable divergence from ${tip.ref}: ${stdout.trim()}`);
  }
  return { ref: tip.ref, sha: tip.sha, ahead, behind };
}

/** A rebase replaying a merge commit re-applies everything that merge brought in as new commits. */
async function rebaseReplaysMerges(worktreePath: string, onto: string): Promise<boolean> {
  const { stdout } = await runGit(["rev-list", "--count", "--merges", `${onto}..HEAD`], {
    cwd: worktreePath,
  });
  return stdout.trim() !== "0";
}

async function branchStrategies(
  worktreePath: string,
  branch: Divergence,
): Promise<WorkspaceUpdateStrategy[]> {
  if (branch.behind === 0) return [];
  if (branch.ahead === 0) return ["merge"];
  return (await rebaseReplaysMerges(worktreePath, branch.sha)) ? ["merge"] : ["rebase", "merge"];
}

/** Rebasing onto the base rewrites every branch commit, which is safe only while none was published. */
async function baseStrategies(
  worktreePath: string,
  base: Divergence,
  branch: Divergence | null,
): Promise<WorkspaceUpdateStrategy[]> {
  if (base.behind === 0 || (branch !== null && branch.behind > 0)) return [];
  if (base.ahead === 0 || branch !== null) return ["merge"];
  return (await rebaseReplaysMerges(worktreePath, base.sha)) ? ["merge"] : ["rebase", "merge"];
}

export async function compareWithRemote(
  worktreePath: string,
  tips: RemoteTips,
): Promise<Pick<ComparedWorkspaceFreshness, "branch" | "base">> {
  const branch = tips.branch && (await divergence(worktreePath, tips.branch));
  const base = tips.base && (await divergence(worktreePath, tips.base));
  return {
    branch: branch && { ...branch, strategies: await branchStrategies(worktreePath, branch) },
    base: base && { ...base, strategies: await baseStrategies(worktreePath, base, branch) },
  };
}
