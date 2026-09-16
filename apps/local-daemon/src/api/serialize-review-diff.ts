import { reviewDiffResponseSchema, type ReviewDiffResponse } from "@otomat/domain";

import { toDiffFileContract } from "#git";
import type { ReviewDiffResult } from "#review";

/** Maps a `ReviewDiffResult` to its wire contract, remapping camelCase fields to snake_case; `diff` is null when the result carries no computed diff. */
export function toReviewDiffResponse(
  subjectId: string,
  result: ReviewDiffResult,
): ReviewDiffResponse {
  const diff = result.diff;
  return reviewDiffResponseSchema.parse({
    subject_id: subjectId,
    computed_at: result.computedAt,
    diff: diff
      ? {
          base: diff.base,
          head: diff.head,
          additions: diff.additions,
          deletions: diff.deletions,
          sha: diff.sha,
          files: diff.files.map(toDiffFileContract),
        }
      : null,
    scope: result.scope,
    unavailable: result.unavailable,
  });
}
