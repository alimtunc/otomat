import type { PullRequestReviewEvent } from "@otomat/domain";
import { z } from "zod";

import { parseGitHubJson } from "../parse.js";
import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type { ReviewSubmissionInput } from "./contract.js";

const EVENTS = {
  comment: "COMMENT",
  request_changes: "REQUEST_CHANGES",
  approve: "APPROVE",
} as const satisfies Record<PullRequestReviewEvent, string>;

const submittedSchema = z.object({ html_url: z.string() });

/** GitHub accepts the whole review or none of it, so a refusal can never leave half of it published. */
export async function submitPullRequestReview(
  run: CommandRunner,
  input: ReviewSubmissionInput,
): Promise<{ url: string }> {
  const result = await run({
    command: "gh",
    args: [
      "api",
      "--method",
      "POST",
      `repos/${input.repository}/pulls/${input.number}/reviews`,
      "--input",
      "-",
    ],
    cwd: input.cwd,
    stdin: JSON.stringify({
      commit_id: input.commitSha,
      body: input.body,
      event: EVENTS[input.event],
      comments: input.comments,
    }),
  });
  assertPublicationSucceeded(result, "github_review_submit_failed", "GitHub refused the review.");
  return {
    url: parseGitHubJson(
      result.stdout,
      (payload) => submittedSchema.parse(payload).html_url,
      "github_review_unreadable",
      "GitHub accepted the review but its answer could not be read.",
    ),
  };
}
