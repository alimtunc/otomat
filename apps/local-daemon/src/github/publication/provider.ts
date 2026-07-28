import type { PullRequestPatch, PullRequestRow } from "@otomat/db";

import { normalizePullRequestBody } from "../body.js";
import { GitHubPublicationError } from "../errors.js";
import type { GitHubCli, GitHubPullRequest, PullRequestSelector } from "../types.js";
import type { PublicationStore } from "./store.js";
import type { ProviderResult, PublicationRequest } from "./types.js";

export function metadataMatches(provider: GitHubPullRequest, request: PublicationRequest): boolean {
  return (
    provider.title === request.title &&
    normalizePullRequestBody(provider.body) === request.normalizedBody
  );
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
  await cli.createPullRequest({
    ...selector,
    title: request.title,
    body: request.body,
  });
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
