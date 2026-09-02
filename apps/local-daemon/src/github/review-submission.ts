import { getPullRequest } from "@otomat/db";

import type { PullRequestReviewSubmission } from "#review";

import { GitHubPublicationError } from "./errors.js";
import { pullRequestCwd } from "./pull-request-cwd.js";
import { reviewCommentPayload } from "./review-comment-payload.js";
import type { GitHubServiceConfig } from "./types.js";

/** Anchored to the head GitHub itself carries — what Otomat pushed, or what the imported pull request reports. */
export async function submitPullRequestReview(
  config: GitHubServiceConfig,
  pullRequestId: string,
  input: PullRequestReviewSubmission,
): Promise<{ url: string }> {
  const pullRequest = getPullRequest(config.db, pullRequestId);
  if (!pullRequest || pullRequest.number === null) {
    throw new GitHubPublicationError("pr_missing", "There is no pull request to review.");
  }
  const cwd = pullRequestCwd(config, pullRequest);
  return config.cli.submitReview({
    cwd,
    repository: (await config.cli.resolveRemote(cwd)).repository,
    number: pullRequest.number,
    commitSha: input.commitSha,
    body: input.body,
    event: input.event,
    comments: input.comments.map(reviewCommentPayload),
  });
}
