import { DaemonRequestError } from "@otomat/client";
import {
  PR_GENERATION_INVALID_CODE,
  pullRequestGenerationErrorSchema,
  type PullRequestContract,
} from "@otomat/domain";

/** The compact path generates inside the publication, so its refusal reaches the operator on the row instead of as an answer. */
export function pullRequestGenerationRefusal(
  error: unknown,
  pullRequest: PullRequestContract | null,
): string | null {
  if (error instanceof DaemonRequestError) {
    const refusal = pullRequestGenerationErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
  }
  if (pullRequest === null || pullRequest.commit_subject !== null) return null;
  if (pullRequest.publication_status !== "failed") return null;
  if (pullRequest.error_code !== PR_GENERATION_INVALID_CODE) return null;
  return pullRequest.error_message;
}
