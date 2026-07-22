import { pullRequestDetailSchema, type PreparePullRequestRequest } from "@otomat/domain";

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
  };
}
