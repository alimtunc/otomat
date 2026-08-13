import type { PullRequestRow } from "@otomat/db";
import type { PushPullRequestRequest } from "@otomat/domain";

import { headSha } from "#git";

import { GitHubPublicationError } from "../errors.js";
import { providerPatch } from "./provider.js";
import type { PublicationStore } from "./store.js";
import type { PublicationConfig, PublicationWorkspace } from "./types.js";
import { resolveWorkspace } from "./workspace.js";

interface PushTarget {
  workspace: PublicationWorkspace;
  headRef: string;
}

function requireOpenPullRequest(row: PullRequestRow | undefined): {
  row: PullRequestRow;
  headRef: string;
  number: number;
} {
  if (row === undefined || row.number === null || row.head_ref === null) {
    throw new GitHubPublicationError(
      "pr_not_published",
      "Create the pull request before pushing commits to it.",
    );
  }
  if (row.status === "merged" || row.status === "closed") {
    throw new GitHubPublicationError(
      "pr_not_open",
      `Pull request #${row.number} is ${row.status}; it takes no further commits.`,
    );
  }
  return { row, headRef: row.head_ref, number: row.number };
}

/** Refused before git is invoked, so `--force-with-lease` is only ever reached for a live pull request's own head. */
async function assertLeasable(
  config: PublicationConfig,
  target: PushTarget,
  expected: string,
): Promise<void> {
  const { workspace, headRef } = target;
  const { path } = workspace.worktree;
  if (headRef === workspace.baseRef || headRef === workspace.defaultBranch) {
    throw new GitHubPublicationError(
      "force_push_base_branch",
      `${headRef} is a base branch; Otomat never rewrites one.`,
    );
  }
  if (await config.cli.remoteBranchProtected(path, workspace.remote.repository, headRef)) {
    throw new GitHubPublicationError(
      "force_push_branch_protected",
      `GitHub protects ${headRef}; rewrite it there, not from Otomat.`,
    );
  }
  const current = await config.cli.remoteHead(path, workspace.remote.name, headRef);
  if (current !== expected) {
    throw new GitHubPublicationError(
      "github_push_lease_stale",
      `${headRef} moved on GitHub since it was read, so nothing was overwritten. Refresh the comparison and confirm again.`,
    );
  }
}

async function writeBranch(
  config: PublicationConfig,
  target: PushTarget,
  request: PushPullRequestRequest,
): Promise<void> {
  const { workspace, headRef } = target;
  if (request.expected_remote_sha === undefined) {
    await config.cli.push(workspace.worktree.path, workspace.remote.name, headRef);
    return;
  }
  await assertLeasable(config, target, request.expected_remote_sha);
  await config.cli.forcePushWithLease({
    cwd: workspace.worktree.path,
    remote: workspace.remote.name,
    branch: headRef,
    expectedRemoteSha: request.expected_remote_sha,
  });
}

/** Evidence is written from the pushed commit, never the working tree: no push can clear uncommitted work. */
export async function pushCommits(
  config: PublicationConfig,
  store: PublicationStore,
  stored: PullRequestRow | undefined,
  request: PushPullRequestRequest,
): Promise<PullRequestRow> {
  const { row, headRef, number } = requireOpenPullRequest(stored);
  const workspace = await resolveWorkspace(config, row.run_id);
  const provider = await config.cli.viewPullRequest(
    workspace.worktree.path,
    workspace.remote.repository,
    number,
  );
  const current = requireOpenPullRequest(store.reconcileLifecycle(row, provider.lifecycle)).row;
  if (provider.headRef !== headRef) {
    throw new GitHubPublicationError(
      "pr_head_mismatch",
      `Pull request #${number} now ships ${provider.headRef}, not ${headRef}. Otomat pushes only the branch it published.`,
    );
  }
  const reconciled = store.reconcilePublication(current, "created");

  const pushed = headSha(workspace.worktree.path);
  try {
    await writeBranch(config, { workspace, headRef }, request);
  } catch (error) {
    throw store.recordPushFailure(reconciled, error);
  }
  return store.patch(
    reconciled,
    {
      ...providerPatch(provider),
      published_head_sha: pushed,
      published_diff_sha: workspace.worktrees.commitDiff(row.run_id, pushed).sha,
    },
    "github",
  );
}
