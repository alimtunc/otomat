import { issueContractSchema, type CreateIssueRequest } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

export function createIssuesClient(config: DaemonClientConfig) {
  return {
    async listIssues(params: { projectId?: string } = {}) {
      return issueContractSchema
        .array()
        .parse(await getJson(config, `/api/issues${queryString(params)}`));
    },
    async createIssue(request: CreateIssueRequest) {
      return issueContractSchema.parse(await postJson(config, "/api/issues", request));
    },
    async getIssue(id: string) {
      return issueContractSchema.parse(
        await getJson(config, `/api/issues/${encodeURIComponent(id)}`),
      );
    },
  };
}
