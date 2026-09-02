import { fetchPullRequestTrees, type PullRequestTrees } from "#git";

import type { GitHubCli, GitHubPullRequest, PullRequestOverviewFacts } from "../cli/contract.js";
import { failureMessage, PullRequestImportRefusal } from "../errors.js";
import type { IssueRepository } from "./repository.js";

async function readOrRefuse<T>(
  repository: IssueRepository,
  number: number,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw new PullRequestImportRefusal(
      "pr_not_found",
      `GitHub could not read ${repository.remote.repository}#${number}: ${failureMessage(error)}`,
    );
  }
}

export function readPullRequest(
  cli: GitHubCli,
  repository: IssueRepository,
  number: number,
): Promise<GitHubPullRequest> {
  return readOrRefuse(repository, number, () =>
    cli.viewPullRequest(repository.binding.rootPath, repository.remote.repository, number),
  );
}

export function readOverviewFacts(
  cli: GitHubCli,
  repository: IssueRepository,
  number: number,
): Promise<PullRequestOverviewFacts> {
  return readOrRefuse(repository, number, () =>
    cli.viewPullRequestOverview({
      cwd: repository.binding.rootPath,
      repository: repository.remote.repository,
      number,
    }),
  );
}

/** Isolation is the fetch itself: the head lands in a read-only ref, so review holds no branch it could push. */
export function fetchHeadTrees(
  repository: IssueRepository,
  provider: GitHubPullRequest,
): PullRequestTrees {
  try {
    return fetchPullRequestTrees({
      repoRoot: repository.binding.rootPath,
      remote: repository.remote.name,
      number: provider.number,
      baseRef: provider.baseRef,
    });
  } catch (error) {
    throw new PullRequestImportRefusal(
      "pr_lookup_failed",
      `The pull request head could not be fetched: ${failureMessage(error)}`,
    );
  }
}

export async function connectedLogin(cli: GitHubCli): Promise<string | null> {
  const connection = await cli.connection();
  return connection.status === "connected" ? connection.login : null;
}
