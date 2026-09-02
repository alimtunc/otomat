import { z } from "zod";

import {
  parsePullRequestJson,
  PR_JSON_FIELDS,
  providerPullRequestSchema,
  toPullRequest,
} from "../parse.js";
import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type {
  GitHubPullRequest,
  PullRequestListInput,
  PullRequestSearchInput,
  PullRequestSelector,
} from "./contract.js";

function parsePullRequestList(stdout: string, repository: string): GitHubPullRequest[] {
  return parsePullRequestJson(stdout, (payload) =>
    z.array(providerPullRequestSchema).parse(payload),
  ).map((entry) => toPullRequest(entry, repository));
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
  return parsePullRequestList(result.stdout, input.repository)[0] ?? null;
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
      // Quoting keeps a hyphenated identifier as one search term instead of two unrelated terms.
      `"${input.identifier}" in:title,body`,
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
  return parsePullRequestList(result.stdout, input.repository);
}

export async function listOpenPullRequests(
  run: CommandRunner,
  input: PullRequestListInput,
): Promise<GitHubPullRequest[]> {
  const result = await run({
    command: "gh",
    args: [
      "pr",
      "list",
      "--repo",
      input.repository,
      "--state",
      "open",
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
    "GitHub pull requests could not be listed.",
  );
  return parsePullRequestList(result.stdout, input.repository);
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
  return parsePullRequestJson(result.stdout, (payload) => toPullRequest(payload, repository));
}
