import { pullRequestReviewStateSchema } from "@otomat/domain";
import { z } from "zod";

import {
  parseGitHubJson,
  parsePullRequestJson,
  PR_JSON_FIELDS,
  providerPullRequestSchema,
  toPullRequest,
} from "../parse.js";
import { toChecks } from "../pull-request-facts.js";
import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type {
  GitHubRepositoryTarget,
  PullRequestOverviewFacts,
  PullRequestTarget,
  RepositoryMergePolicy,
} from "./contract.js";

/** An unrecognised verdict is listed as a plain comment rather than dropping the reviewer from the list. */
const reviewState = pullRequestReviewStateSchema.catch("commented");

const PR_OVERVIEW_JSON_FIELDS = `${PR_JSON_FIELDS},additions,deletions,changedFiles,commits,latestReviews,mergeStateStatus`;

const overviewSchema = providerPullRequestSchema.extend({
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changedFiles: z.number().int().nonnegative(),
  commits: z.array(z.unknown()).nullish(),
  latestReviews: z
    .array(
      z.object({
        author: z.object({ login: z.string().min(1) }).nullish(),
        state: z.string(),
        submittedAt: z.iso.datetime().nullish(),
      }),
    )
    .nullish(),
  mergeStateStatus: z.string().nullish(),
});

export async function viewPullRequestOverview(
  run: CommandRunner,
  input: PullRequestTarget,
): Promise<PullRequestOverviewFacts> {
  const result = await run({
    command: "gh",
    args: [
      "pr",
      "view",
      String(input.number),
      "--repo",
      input.repository,
      "--json",
      PR_OVERVIEW_JSON_FIELDS,
    ],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_pr_lookup_failed",
    "The GitHub pull request could not be read.",
  );
  const parsed = parsePullRequestJson(result.stdout, (payload) => overviewSchema.parse(payload));
  return {
    pullRequest: toPullRequest(parsed, input.repository),
    checks: toChecks(parsed.statusCheckRollup ?? []),
    reviews: (parsed.latestReviews ?? []).map((review) => ({
      author_login: review.author?.login ?? null,
      state: reviewState.parse(review.state.toLowerCase()),
      submitted_at: review.submittedAt ?? null,
    })),
    commits: parsed.commits?.length ?? 0,
    changedFiles: parsed.changedFiles,
    additions: parsed.additions,
    deletions: parsed.deletions,
    mergeState: (parsed.mergeStateStatus ?? "UNKNOWN").toUpperCase(),
  };
}

const repositorySchema = z.object({
  allow_merge_commit: z.boolean().nullish(),
  allow_squash_merge: z.boolean().nullish(),
  permissions: z.object({ push: z.boolean().nullish() }).nullish(),
});

/** An unreadable capability is never assumed: a missing flag reads as not allowed, a missing permission as no permission. */
export async function readRepositoryMergePolicy(
  run: CommandRunner,
  input: GitHubRepositoryTarget,
): Promise<RepositoryMergePolicy> {
  const result = await run({
    command: "gh",
    args: ["api", `repos/${input.repository}`],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_repository_lookup_failed",
    "The GitHub repository settings could not be read.",
  );
  const parsed = parseGitHubJson(
    result.stdout,
    (payload) => repositorySchema.parse(payload),
    "github_repository_response_invalid",
    "GitHub returned invalid repository settings.",
  );
  return {
    methods: [
      ...(parsed.allow_merge_commit === true ? (["merge"] as const) : []),
      ...(parsed.allow_squash_merge === true ? (["squash"] as const) : []),
    ],
    canPush: parsed.permissions?.push === true,
  };
}
