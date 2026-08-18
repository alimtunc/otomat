import {
  commentFixProofSchema,
  diffFileBlobsResponseSchema,
  pullRequestInboxSchema,
  reviewCommentContractSchema,
  reviewDetailSchema,
  reviewDiffResponseSchema,
  runContractSchema,
  runDiffScopeParams,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
  type ReviewTarget,
  type RunDiffScopeSelector,
  type SyncPullRequestInboxRequest,
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
    async getPullRequestInbox(projectId: string) {
      return pullRequestInboxSchema.parse(
        await getJson(config, `/api/reviews${queryString({ projectId })}`),
      );
    },
    async syncPullRequestInbox(projectId: string) {
      const request: SyncPullRequestInboxRequest = { project_id: projectId };
      return pullRequestInboxSchema.parse(await postJson(config, "/api/reviews/sync", request));
    },
    async getReviewDiff(target: ReviewTarget, scope: RunDiffScopeSelector) {
      const query = queryString(runDiffScopeParams(scope));
      return reviewDiffResponseSchema.parse(
        await getJson(config, `${reviewPath(target)}/diff${query}`),
      );
    },
    async getReviewDetail(target: ReviewTarget) {
      return reviewDetailSchema.parse(await getJson(config, `${reviewPath(target)}/review`));
    },
    async getDiffFileBlobs(
      target: ReviewTarget,
      path: string,
      sha: string,
      scope: RunDiffScopeSelector,
    ) {
      const query = queryString({ path, sha, ...runDiffScopeParams(scope) });
      return diffFileBlobsResponseSchema.parse(
        await getJson(config, `${reviewPath(target)}/diff/file${query}`),
      );
    },
    async getCommentFixProof(id: string, commentId: string) {
      const run = encodeURIComponent(id);
      const comment = encodeURIComponent(commentId);
      return commentFixProofSchema.parse(
        await getJson(config, `/api/runs/${run}/review/comments/${comment}/fix-proof`),
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
