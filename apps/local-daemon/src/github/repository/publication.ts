import {
  findPullRequestByNumber,
  getPullRequest,
  updatePullRequest,
  type PullRequestRow,
  type PullRequestPatch,
} from "@otomat/db";
import {
  formatCommitSubject,
  type PublishRepositoryPullRequest,
  type PullRequestProposal,
} from "@otomat/domain";

import { runGit, sourceControlSnapshot } from "#git";

import { GitHubPublicationError } from "../errors.js";
import { applyProviderState, insertMirroredPullRequest } from "../import/store.js";
import { classifyPullRequest } from "../import/verify.js";
import { updateDetails } from "../publication/provider.js";
import type { GitHubServiceConfig } from "../types.js";
import { generateRepositoryProposal } from "./generation.js";
import { prepareRepositoryPublication } from "./workspace.js";

export async function publishRepositoryPullRequest(
  config: GitHubServiceConfig & { idFactory(): string },
  repositoryId: string,
  request: PublishRepositoryPullRequest,
): Promise<PullRequestRow> {
  const workspace = await prepareRepositoryPublication(config, repositoryId, request);
  const { cwd, remote, snapshot, connection } = workspace;
  let proposal: PullRequestProposal | null = null;
  let details = request.details;
  if (details === undefined) {
    proposal = await generateRepositoryProposal(config, workspace);
    details = { subject: proposal.subject, body: proposal.body, head_ref: proposal.branch };
  }
  const head = details.head_ref ?? snapshot.response.branch;
  if (
    head.startsWith("-") ||
    runGit(["check-ref-format", `refs/heads/${head}`], { cwd, allowFailure: true }).exitCode !== 0
  )
    throw new GitHubPublicationError("branch_invalid", "Enter a valid Git branch name.");
  if ([request.base_ref, workspace.defaultBranch, "main", "master", "HEAD"].includes(head))
    throw new GitHubPublicationError(
      "branch_protected",
      "Choose a dedicated source branch before creating a pull request.",
    );
  const title = formatCommitSubject(details.subject);
  const remoteHead = await config.cli.remoteHead(cwd, remote.name, head);
  if (head !== snapshot.response.branch && remoteHead !== null)
    throw new GitHubPublicationError(
      "branch_exists",
      "This remote branch already exists. Choose a new branch name.",
    );
  if (remoteHead !== null && (await config.cli.remoteBranchProtected(cwd, remote.repository, head)))
    throw new GitHubPublicationError("branch_protected", "Choose an unprotected source branch.");
  if (sourceControlSnapshot(cwd).response.revision !== request.revision)
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed during preparation. Refresh before publishing.",
    );
  if (head !== snapshot.response.branch) {
    const switched = runGit(["switch", "-c", head], { cwd, allowFailure: true });
    if (switched.exitCode !== 0)
      throw new GitHubPublicationError(
        "branch_unavailable",
        switched.stderr.trim() || "Could not create this branch.",
      );
  }
  const selector = { cwd, repository: remote.repository, head, base: request.base_ref };
  const existing = await config.cli.findPullRequest(selector);
  if (existing !== null && existing.lifecycle !== "open" && existing.lifecycle !== "draft")
    throw new GitHubPublicationError(
      "pr_terminal",
      "This branch's pull request is closed. Choose a new branch.",
    );
  await config.cli.push(cwd, remote.name, head, snapshot.head);
  if (existing === null)
    await config.cli.createPullRequest({
      ...selector,
      title,
      body: details.body,
      draft: request.mode === "draft",
    });
  else
    await updateDetails(config.cli, existing, selector, {
      title,
      body: details.body,
      normalizedBody: details.body || null,
      mode: request.mode,
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
  const existingRow = findPullRequestByNumber(config.db, repositoryId, provider.number);
  const state = { provider, provenance, trees: null, syncedAt: new Date().toISOString() };
  const row =
    existingRow === undefined
      ? insertMirroredPullRequest(config, {
          ...state,
          issueId: null,
          repositoryId,
          evidence: null,
          attachedBy: null,
        })
      : applyProviderState(config, existingRow, state);
  const patch: PullRequestPatch = { commit_subject: title };
  if (proposal !== null) {
    patch.generator_runtime = proposal.generator.runtime;
    patch.generator_model = proposal.generator.model;
    patch.generator_effort = proposal.generator.effort;
  }
  updatePullRequest(config.db, row.id, patch);
  const saved = getPullRequest(config.db, row.id);
  if (saved === undefined) throw new Error("Published pull request was not saved.");
  return saved;
}
