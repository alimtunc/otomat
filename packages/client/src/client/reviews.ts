import {
  reviewCommentContractSchema,
  reviewDetailSchema,
  runContractSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson } from "./http.js";

export function createReviewsClient(config: DaemonClientConfig) {
  return {
    async getRunReview(id: string) {
      return reviewDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/review`),
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
