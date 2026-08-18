import { z } from "zod";

import { assertPublicationSucceeded } from "./cli-commands.js";
import {
  parsePullRequestJson,
  PR_JSON_FIELDS,
  providerPullRequestSchema,
  toPullRequest,
} from "./parse.js";
import type {
  CommandRunner,
  GitHubPullRequest,
  PullRequestSearchInput,
  PullRequestSelector,
} from "./types.js";

function parsePullRequestList(stdout: string): GitHubPullRequest[] {
  return parsePullRequestJson(stdout, (payload) =>
    z.array(providerPullRequestSchema).parse(payload),
  ).map(toPullRequest);
}

export async function findPullRequest(
  run: CommandRunner,
  input: PullRequestSelector,
): Promise<GitHubPullRequest | null> {
  const result = await run({
    command: "gh",
    args: [
      "pr",
      "list",
      "--repo",
      input.repository,
      "--head",
      input.head,
      "--base",
      input.base,
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      PR_JSON_FIELDS,
    ],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_pr_lookup_failed",
    "GitHub pull requests could not be queried.",
  );
  return parsePullRequestList(result.stdout)[0] ?? null;
}

export async function searchPullRequests(
  run: CommandRunner,
  input: PullRequestSearchInput,
): Promise<GitHubPullRequest[]> {
  const result = await run({
    command: "gh",
    args: [
      "pr",
      "list",
      "--repo",
      input.repository,
      "--search",
      input.query,
      "--state",
      "all",
      "--limit",
      String(input.limit),
      "--json",
      PR_JSON_FIELDS,
    ],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_pr_lookup_failed",
    "GitHub pull requests could not be searched.",
  );
  return parsePullRequestList(result.stdout);
}

export async function viewPullRequest(
  run: CommandRunner,
  cwd: string,
  repository: string,
  number: number,
): Promise<GitHubPullRequest> {
  const result = await run({
    command: "gh",
    args: ["pr", "view", String(number), "--repo", repository, "--json", PR_JSON_FIELDS],
    cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_pr_lookup_failed",
    "The GitHub pull request could not be read.",
  );
  return parsePullRequestJson(result.stdout, toPullRequest);
}
