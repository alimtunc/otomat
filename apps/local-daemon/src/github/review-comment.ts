import { getPullRequest } from "@otomat/db";
import type { DiffSide } from "@otomat/domain";

import type { PullRequestCommentInput } from "#review";

import { reviewCommentBody } from "./body.js";
import { GitHubPublicationError } from "./errors.js";
import { pullRequestCwd } from "./pull-request-cwd.js";
import type { GitHubServiceConfig, ReviewCommentCreateInput, ReviewCommentSide } from "./types.js";

function side(value: DiffSide): ReviewCommentSide {
  return value === "old" ? "LEFT" : "RIGHT";
}

/** Anchored to the head GitHub itself carries — what Otomat pushed, or what the imported pull request reports. */
export async function publishReviewComment(
  config: GitHubServiceConfig,
  pullRequestId: string,
  input: PullRequestCommentInput,
): Promise<{ url: string }> {
  const pullRequest = getPullRequest(config.db, pullRequestId);
  if (!pullRequest || pullRequest.number === null) {
    throw new GitHubPublicationError("pr_missing", "There is no pull request to comment on.");
  }
  if (input.line === null) {
    throw new GitHubPublicationError(
      "comment_line_missing",
      "GitHub anchors a review comment to lines, so a whole-file note cannot be published.",
    );
  }
  const cwd = pullRequestCwd(config, pullRequest);

  const request: ReviewCommentCreateInput = {
    cwd,
    repository: (await config.cli.resolveRemote(cwd)).repository,
    number: pullRequest.number,
    commitSha: input.commitSha,
    path: input.filePath,
    body: reviewCommentBody(input.body, input.suggestion),
    side: side(input.side),
    line: input.line,
  };
  if (input.startLine !== null) {
    request.startLine = input.startLine;
    request.startSide = side(input.side);
  }
  return config.cli.createReviewComment(request);
}
