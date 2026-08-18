import {
  diffFileBlobsResponseSchema,
  reviewCommentContractSchema,
  reviewDetailSchema,
  reviewDiffResponseSchema,
  reviewQueueEntrySchema,
  runContractSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
  type ReviewTarget,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

/** A run and an adopted pull request expose the same review surface under their own collection. */
function reviewPath(target: ReviewTarget): string {
  const collection = target.kind === "run" ? "runs" : "pull-requests";
  return `/api/${collection}/${encodeURIComponent(target.id)}`;
}

export function createReviewsClient(config: DaemonClientConfig) {
  return {
    async listReviewQueue(projectId: string) {
      return reviewQueueEntrySchema
        .array()
        .parse(await getJson(config, `/api/reviews${queryString({ projectId })}`));
    },
    async getReviewDiff(target: ReviewTarget) {
      return reviewDiffResponseSchema.parse(await getJson(config, `${reviewPath(target)}/diff`));
    },
    async getReviewDetail(target: ReviewTarget) {
      return reviewDetailSchema.parse(await getJson(config, `${reviewPath(target)}/review`));
    },
    async getDiffFileBlobs(target: ReviewTarget, path: string, sha: string) {
      return diffFileBlobsResponseSchema.parse(
        await getJson(config, `${reviewPath(target)}/diff/file${queryString({ path, sha })}`),
      );
    },
    async addReviewComment(target: ReviewTarget, request: CreateReviewCommentRequest) {
      return reviewCommentContractSchema.parse(
        await postJson(config, `${reviewPath(target)}/review/comments`, request),
      );
    },
    async publishReviewComment(target: ReviewTarget, commentId: string) {
      const comment = encodeURIComponent(commentId);
      return reviewCommentContractSchema.parse(
        await postJson(config, `${reviewPath(target)}/review/comments/${comment}/publish`, {}),
      );
    },
    async requestFix(runId: string, request: RequestFixRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(runId)}/review/fix`, request),
      );
    },
  };
}
