import { findPullRequestByNumber, type PullRequestRow } from "@otomat/db";
import type { PublishRepositoryPullRequest } from "@otomat/domain";

import { isRepositoryRoot, runGit, sourceControlSnapshot } from "#git";

import { GitHubPublicationError } from "./errors.js";
import { applyProviderState, insertMirroredPullRequest } from "./import/store.js";
import { classifyPullRequest } from "./import/verify.js";
import { updateDetails } from "./publication/provider.js";
import type { GitHubServiceConfig } from "./types.js";

export async function publishRepositoryPullRequest(
  config: GitHubServiceConfig & { idFactory(): string },
  repositoryId: string,
  request: PublishRepositoryPullRequest,
): Promise<PullRequestRow> {
  const binding = config.repositories.forRepository(repositoryId);
  if (binding === null || !isRepositoryRoot(binding.rootPath))
    throw new GitHubPublicationError(
      "workspace_unavailable",
      "The project checkout is unavailable.",
    );
  const cwd = binding.rootPath;
  for (const branch of [request.head_ref, request.base_ref]) {
    if (
      branch.startsWith("-") ||
      runGit(["check-ref-format", `refs/heads/${branch}`], { cwd, allowFailure: true }).exitCode !==
        0
    )
      throw new GitHubPublicationError("branch_invalid", "Enter a valid Git branch name.");
  }
  if (
    [request.base_ref, binding.defaultBranch, "main", "master", "HEAD"].includes(request.head_ref)
  )
    throw new GitHubPublicationError(
      "branch_protected",
      "Choose a dedicated source branch before creating a pull request.",
    );
  const snapshot = sourceControlSnapshot(cwd);
  if (snapshot.response.conflicts.length > 0 || snapshot.response.revision !== request.revision)
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed. Refresh before publishing.",
    );
  if (snapshot.response.staged.length > 0)
    throw new GitHubPublicationError(
      "uncommitted_changes",
      "Commit the staged changes before creating a pull request.",
    );
  const connection = await config.cli.connection();
  if (connection.status !== "connected")
    throw new GitHubPublicationError(
      "github_auth_required",
      "Connect GitHub in Settings before creating a pull request.",
    );
  const remote = await config.cli.resolveRemote(cwd);
  const remoteHead = await config.cli.remoteHead(cwd, remote.name, request.head_ref);
  if (request.head_ref !== snapshot.response.branch && remoteHead !== null)
    throw new GitHubPublicationError(
      "branch_exists",
      "This remote branch already exists. Choose a new branch name.",
    );
  if (
    remoteHead !== null &&
    (await config.cli.remoteBranchProtected(cwd, remote.repository, request.head_ref))
  )
    throw new GitHubPublicationError("branch_protected", "Choose an unprotected source branch.");
  await config.cli.fetchBranch(cwd, remote.name, request.base_ref);
  const base = runGit(["rev-parse", "FETCH_HEAD"], { cwd }).stdout.trim();
  const diff = runGit(["diff", "--quiet", `${base}...${snapshot.head}`], {
    cwd,
    allowFailure: true,
  });
  if (diff.exitCode !== 1)
    throw new GitHubPublicationError(
      "diff_empty",
      "No committed changes to publish against this base. Commit your changes first.",
    );
  if (sourceControlSnapshot(cwd).response.revision !== request.revision)
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed during preparation. Refresh before publishing.",
    );
  if (request.head_ref !== snapshot.response.branch) {
    const switched = runGit(["switch", "-c", request.head_ref], { cwd, allowFailure: true });
    if (switched.exitCode !== 0)
      throw new GitHubPublicationError(
        "branch_unavailable",
        switched.stderr.trim() || "Could not create this branch.",
      );
  }
  const selector = {
    cwd,
    repository: remote.repository,
    head: request.head_ref,
    base: request.base_ref,
  };
  const existing = await config.cli.findPullRequest(selector);
  if (existing !== null && existing.lifecycle !== "open" && existing.lifecycle !== "draft")
    throw new GitHubPublicationError(
      "pr_terminal",
      "This branch's pull request is closed. Choose a new branch.",
    );
  await config.cli.push(cwd, remote.name, request.head_ref, snapshot.head);
  if (existing === null)
    await config.cli.createPullRequest({
      ...selector,
      title: request.title,
      body: request.body,
      draft: request.draft,
    });
  else
    await updateDetails(config.cli, existing, selector, {
      title: request.title,
      body: request.body,
      normalizedBody: request.body || null,
      mode: request.draft ? "draft" : "ready",
    });
  const provider = await config.cli.findPullRequest(selector);
  if (provider === null)
    throw new GitHubPublicationError(
      "github_pr_unconfirmed",
      "The branch was pushed, but GitHub has not confirmed the pull request. Retry to find it.",
    );
  const { provenance } = classifyPullRequest(config.db, {
    repositoryId,
    provider,
    connectedLogin: connection.login,
  });
  const row = findPullRequestByNumber(config.db, repositoryId, provider.number);
  const state = { provider, provenance, trees: null, syncedAt: new Date().toISOString() };
  if (row !== undefined) return applyProviderState(config, row, state);
  return insertMirroredPullRequest(config, {
    ...state,
    issueId: null,
    repositoryId,
    evidence: null,
    attachedBy: null,
  });
}
