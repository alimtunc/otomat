import {
  diffFileBlobsResponseSchema,
  reviewCommentContractSchema,
  reviewDetailSchema,
  runContractSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

export function createReviewsClient(config: DaemonClientConfig) {
  return {
    async getRunReview(id: string) {
      return reviewDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/review`),
      );
    },
    async getDiffFileBlobs(id: string, path: string, sha: string) {
      const run = encodeURIComponent(id);
      return diffFileBlobsResponseSchema.parse(
        await getJson(config, `/api/runs/${run}/diff/file${queryString({ path, sha })}`),
      );
    },
    async addReviewComment(id: string, request: CreateReviewCommentRequest) {
      return reviewCommentContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/review/comments`, request),
      );
    },
    async requestFix(id: string, request: RequestFixRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/review/fix`, request),
      );
    },
  };
}
