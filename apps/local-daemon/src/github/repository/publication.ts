import {
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

import { normalizePullRequestBody } from "../body.js";
import type { GitHubPullRequest } from "../cli/contract.js";
import { GitHubPublicationError } from "../errors.js";
import { mirrorPullRequest } from "../import/store.js";
import { createConfirmedPullRequest, updateDetails } from "../publication/provider.js";
import type { PublicationConfig } from "../publication/types.js";
import { generateRepositoryProposal } from "./generation.js";
import { checkoutHeadBranch, prepareRepositoryPublication } from "./workspace.js";

function recordPublication(
  config: PublicationConfig,
  row: PullRequestRow,
  title: string,
  proposal: PullRequestProposal | null,
): PullRequestRow {
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

export async function publishRepositoryPullRequest(
  config: PublicationConfig,
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
  await checkoutHeadBranch(config, workspace, request, head);
  const title = formatCommitSubject(details.subject);
  const selector = { cwd, repository: remote.repository, head, base: request.base_ref };
  const existing = await config.cli.findPullRequest(selector);
  if (existing !== null && existing.lifecycle !== "open" && existing.lifecycle !== "draft")
    throw new GitHubPublicationError(
      "pr_terminal",
      "This branch's pull request is closed. Choose a new branch.",
    );
  await config.cli.push(cwd, remote.name, head, snapshot.head);
  const publication = {
    title,
    body: details.body,
    normalizedBody: normalizePullRequestBody(details.body),
    mode: request.mode,
  };
  let provider: GitHubPullRequest;
  if (existing === null) {
    provider = await createConfirmedPullRequest(config.cli, selector, publication);
  } else {
    await updateDetails(config.cli, existing, selector, publication);
    // The pre-push view is what `existing` holds; the mirrored checks and update time must be the pushed head's.
    provider = await config.cli.viewPullRequest(cwd, remote.repository, existing.number);
  }
  const row = mirrorPullRequest(config, {
    repositoryId,
    provider,
    connectedLogin: connection.login,
    syncedAt: new Date().toISOString(),
  });
  return recordPublication(config, row, title, proposal);
}
