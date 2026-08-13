import { getPullRequestForRun } from "@otomat/db";
import type { DiffSide } from "@otomat/domain";

import type { PullRequestCommentInput } from "#review";

import { reviewCommentBody } from "./body.js";
import { GitHubPublicationError } from "./errors.js";
import type { GitHubServiceConfig, ReviewCommentCreateInput, ReviewCommentSide } from "./types.js";

function side(value: DiffSide): ReviewCommentSide {
  return value === "old" ? "LEFT" : "RIGHT";
}

/** Anchored to the commit the publication actually pushed — never to a local head GitHub has not seen. */
export async function publishReviewComment(
  config: GitHubServiceConfig,
  runId: string,
  input: PullRequestCommentInput,
): Promise<{ url: string }> {
  const pullRequest = getPullRequestForRun(config.db, runId);
  if (!pullRequest || pullRequest.number === null) {
    throw new GitHubPublicationError("pr_missing", "This run has no pull request to comment on.");
  }
  if (pullRequest.published_head_sha === null) {
    throw new GitHubPublicationError(
      "pr_head_unknown",
      `Pull request #${pullRequest.number} has no published head commit to anchor a comment on.`,
    );
  }
  if (input.line === null) {
    throw new GitHubPublicationError(
      "comment_line_missing",
      "GitHub anchors a review comment to lines, so a whole-file note cannot be published.",
    );
  }
  const binding = config.repositories.forRun(runId);
  const cwd = binding?.service.get(runId)?.path ?? binding?.rootPath;
  if (cwd === undefined) {
    throw new GitHubPublicationError(
      "worktree_missing",
      "The run has no repository checkout to reach GitHub from.",
    );
  }

  const request: ReviewCommentCreateInput = {
    cwd,
    repository: (await config.cli.resolveRemote(cwd)).repository,
    number: pullRequest.number,
    commitSha: pullRequest.published_head_sha,
    path: input.filePath,
    body: reviewCommentBody(input.body, input.suggestion),
    side: side(input.side),
    line: input.line,
    ...(input.startLine === null
      ? {}
      : { startLine: input.startLine, startSide: side(input.side) }),
  };
  return config.cli.createReviewComment(request);
}
