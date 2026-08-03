import type { PullRequestPatch, PullRequestRow } from "@otomat/db";

import { normalizePullRequestBody } from "../body.js";
import { GitHubCliError, GitHubPublicationError } from "../errors.js";
import type { GitHubCli, GitHubPullRequest, PullRequestSelector } from "../types.js";
import type { PublicationStore } from "./store.js";
import type {
  ExistingPullRequestResult,
  ProviderResult,
  PublicationContext,
  PublicationRequest,
} from "./types.js";

function metadataMatches(provider: GitHubPullRequest, request: PublicationRequest): boolean {
  return (
    provider.title === request.title &&
    normalizePullRequestBody(provider.body) === request.normalizedBody
  );
}

export async function refreshExistingPullRequest(
  store: PublicationStore,
  cli: GitHubCli,
  row: PullRequestRow,
  context: PublicationContext,
): Promise<ExistingPullRequestResult> {
  if (row.number === null || row.url === null) {
    return { row, completedView: null, provider: null };
  }
  const provider = await cli.viewPullRequest(
    context.worktree.path,
    context.remote.repository,
    row.number,
  );
  row = store.reconcileLifecycle(row, provider.lifecycle);
  const hasPublishedSnapshot = row.published_head_sha !== null && row.published_diff_sha !== null;
  if (hasPublishedSnapshot) row = store.reconcilePublication(row, "created");
  if (provider.lifecycle === "merged" || provider.lifecycle === "closed") {
    row = store.patch(
      row,
      {
        head_ref: provider.headRef,
        base_ref: provider.baseRef,
        error_code: null,
        error_message: null,
      },
      "github",
    );
    return { row, completedView: store.view(row), provider };
  }
  const current = store.view(row);
  return {
    row,
    completedView:
      hasPublishedSnapshot &&
      current.hasUnpublishedChanges === false &&
      metadataMatches(provider, context.request)
        ? current
        : null,
    provider,
  };
}

export function providerPatch(
  provider: GitHubPullRequest,
  snapshot: { headSha: string; diffSha: string },
): PullRequestPatch {
  return {
    provider: "github",
    number: provider.number,
    url: provider.url,
    title: provider.title,
    body: normalizePullRequestBody(provider.body),
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
    published_head_sha: snapshot.headSha,
    published_diff_sha: snapshot.diffSha,
    error_code: null,
    error_message: null,
  };
}

async function createProvider(
  store: PublicationStore,
  cli: GitHubCli,
  row: PullRequestRow,
  selector: PullRequestSelector,
  request: PublicationRequest,
): Promise<ProviderResult> {
  row = store.transition(row, "creating", {}, "github");
  try {
    await cli.createPullRequest({
      ...selector,
      title: request.title,
      body: request.body,
    });
  } catch (error) {
    // A base recorded from a never-pushed local branch is the one create failure the user can only fix upstream — name it.
    if (
      error instanceof GitHubCliError &&
      error.code === "github_pr_create_failed" &&
      !(await cli.remoteBranchExists(selector.cwd, selector.repository, selector.base))
    ) {
      throw new GitHubPublicationError(
        "github_base_branch_missing",
        `The base branch ${selector.base} does not exist on GitHub. Push it, or relaunch the run from a branch that is on the remote.`,
      );
    }
    throw error;
  }
  const provider = await cli.findPullRequest(selector);
  if (provider === null) {
    throw new GitHubPublicationError(
      "github_pr_unconfirmed",
      "GitHub did not return the created pull request.",
    );
  }
  return { row, provider };
}

async function updateProvider(
  cli: GitHubCli,
  provider: GitHubPullRequest,
  selector: PullRequestSelector,
  request: PublicationRequest,
): Promise<GitHubPullRequest> {
  if (metadataMatches(provider, request)) return provider;
  await cli.updatePullRequest({
    cwd: selector.cwd,
    repository: selector.repository,
    number: provider.number,
    title: request.title,
    body: request.body,
  });
  return cli.viewPullRequest(selector.cwd, selector.repository, provider.number);
}

export async function ensureProvider(
  store: PublicationStore,
  cli: GitHubCli,
  row: PullRequestRow,
  selector: PullRequestSelector,
  request: PublicationRequest,
  knownProvider: GitHubPullRequest | null,
): Promise<ProviderResult> {
  const provider = knownProvider ?? (await cli.findPullRequest(selector));
  if (provider === null) return createProvider(store, cli, row, selector, request);
  if (row.number === null) return { row, provider };
  return { row, provider: await updateProvider(cli, provider, selector, request) };
}
