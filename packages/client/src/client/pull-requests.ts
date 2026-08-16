import {
  pullRequestDetailSchema,
  pullRequestProposalSchema,
  type PreparePullRequestRequest,
  type PushPullRequestRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson } from "./http.js";

export function createPullRequestsClient(config: DaemonClientConfig) {
  return {
    async getPullRequest(id: string) {
      return pullRequestDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/pr`),
      );
    },
    async preparePullRequest(id: string, request: PreparePullRequestRequest) {
      return pullRequestDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/pr`, request),
      );
    },
    async pushPullRequestCommits(id: string, request: PushPullRequestRequest) {
      return pullRequestDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/pr/push`, request),
      );
    },
    async generatePullRequestMetadata(id: string) {
      return pullRequestProposalSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/pr/generate`, {}),
      );
    },
  };
}
