import type { PullRequestPatch, PullRequestRow } from "@otomat/db";
import type { PullRequestPublicationMode } from "@otomat/domain";

import { normalizePullRequestBody } from "../body.js";
import { GitHubCliError, GitHubPublicationError } from "../errors.js";
import { mirroredColumns } from "../mirror.js";
import type {
  GitHubCli,
  GitHubPullRequest,
  GitHubRepositoryTarget,
  PullRequestSelector,
} from "../types.js";
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

/** A merged or closed pull request has no draft flag left to argue with; only a live one can disagree. */
function modeMatches(provider: GitHubPullRequest, mode: PullRequestPublicationMode): boolean {
  if (provider.lifecycle !== "draft" && provider.lifecycle !== "open") return true;
  return (provider.lifecycle === "draft") === (mode === "draft");
}

/** Applies the explicitly requested Draft/Ready mode, then re-reads GitHub so the stored state is the provider's answer, not our intent. */
async function applyPublicationMode(
  cli: GitHubCli,
  provider: GitHubPullRequest,
  target: GitHubRepositoryTarget,
  mode: PullRequestPublicationMode,
): Promise<GitHubPullRequest> {
  if (modeMatches(provider, mode)) return provider;
  await cli.setPullRequestMode({
    cwd: target.cwd,
    repository: target.repository,
    number: provider.number,
    draft: mode === "draft",
  });
  return cli.viewPullRequest(target.cwd, target.repository, provider.number);
}

export async function refreshExistingPullRequest(
  store: PublicationStore,
  cli: GitHubCli,
  row: PullRequestRow,
  context: PublicationContext,
): Promise<ExistingPullRequestResult> {
  if (row.number === null || row.url === null) {
    return { row, done: false, provider: null };
  }
  const provider = await cli.viewPullRequest(
    context.workspace.worktree.path,
    context.workspace.remote.repository,
    row.number,
  );
  row = store.reconcilePublication(store.reconcileLifecycle(row, provider.lifecycle), "created");
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
    return { row, done: true, provider };
  }
  return {
    row,
    done: metadataMatches(provider, context.request) && modeMatches(provider, context.request.mode),
    provider,
  };
}

/** Mirrors what GitHub answered, never what was asked for; publication evidence is added only by a path that pushed. */
export function providerPatch(provider: GitHubPullRequest): PullRequestPatch {
  return {
    provider: "github",
    number: provider.number,
    ...mirroredColumns(provider),
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
      draft: request.mode === "draft",
    });
  } catch (error) {
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

/** Title, body and Draft/Ready of a pull request that already exists — the branch it ships is untouched. */
export async function updateDetails(
  cli: GitHubCli,
  provider: GitHubPullRequest,
  target: GitHubRepositoryTarget,
  request: PublicationRequest,
): Promise<GitHubPullRequest> {
  let refreshed = provider;
  if (!metadataMatches(provider, request)) {
    await cli.updatePullRequest({
      cwd: target.cwd,
      repository: target.repository,
      number: provider.number,
      title: request.title,
      body: request.body,
    });
    refreshed = await cli.viewPullRequest(target.cwd, target.repository, provider.number);
  }
  return applyPublicationMode(cli, refreshed, target, request.mode);
}

export async function ensureProvider(
  store: PublicationStore,
  cli: GitHubCli,
  row: PullRequestRow,
  selector: PullRequestSelector,
  request: PublicationRequest,
): Promise<ProviderResult> {
  const existing = await cli.findPullRequest(selector);
  if (existing === null) return createProvider(store, cli, row, selector, request);
  return { row, provider: await applyPublicationMode(cli, existing, selector, request.mode) };
}
