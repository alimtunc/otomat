import type { PullRequestSync } from "@otomat/domain";

import { commitsSince, hasCommit, headSha, uncommittedPaths } from "#git";

import type { GitHubCli } from "../types.js";

export interface SyncInput {
  cli: GitHubCli;
  worktreePath: string;
  remote: string;
  headRef: string;
  /** Fork point the branch is listed against while GitHub holds no head for it yet. */
  baseRef: string;
}

/** The comparison could not be made — said out loud rather than smoothed into "up to date". */
export const UNAVAILABLE_SYNC: PullRequestSync = {
  state: "unavailable",
  dirty: false,
  local_head_sha: null,
  remote_head_sha: null,
  ahead: [],
  replaced: [],
};

async function compare(input: SyncInput): Promise<PullRequestSync> {
  const { cli, worktreePath, remote, headRef } = input;
  const dirty = uncommittedPaths(worktreePath).length > 0;
  const local = headSha(worktreePath);
  const remoteSha = await cli.remoteHead(worktreePath, remote, headRef);

  if (remoteSha === null) {
    const ahead = commitsSince(worktreePath, input.baseRef, "HEAD");
    return {
      state: "ahead",
      dirty,
      local_head_sha: local,
      remote_head_sha: null,
      ahead,
      replaced: [],
    };
  }
  if (remoteSha === local) {
    return {
      state: "in_sync",
      dirty,
      local_head_sha: local,
      remote_head_sha: remoteSha,
      ahead: [],
      replaced: [],
    };
  }
  if (!hasCommit(worktreePath, remoteSha)) {
    await cli.fetchBranch(worktreePath, remote, headRef);
    if (!hasCommit(worktreePath, remoteSha)) {
      return { ...UNAVAILABLE_SYNC, dirty, local_head_sha: local, remote_head_sha: remoteSha };
    }
  }
  const replaced = commitsSince(worktreePath, "HEAD", remoteSha);
  return {
    state: replaced.length === 0 ? "ahead" : "diverged",
    dirty,
    local_head_sha: local,
    remote_head_sha: remoteSha,
    ahead: commitsSince(worktreePath, remoteSha, "HEAD"),
    replaced,
  };
}

/** A failure here is a state the user is shown, not one that aborts reading the pull request. */
export async function computeSync(input: SyncInput): Promise<PullRequestSync> {
  try {
    return await compare(input);
  } catch (error) {
    console.error(`[otomat] pull request comparison for ${input.headRef} failed`, error);
    return UNAVAILABLE_SYNC;
  }
}
