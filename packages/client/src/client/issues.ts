import {
  issueContractSchema,
  issueSummarySchema,
  issueSearchResponseSchema,
  type CreateIssueRequest,
  type MoveIssueProjectRequest,
  type SetIssueStatusRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, patchJson, postJson, queryString } from "./http.js";

export function createIssuesClient(config: DaemonClientConfig) {
  return {
    async listIssueSummaries(projectId: string) {
      return issueSummarySchema
        .array()
        .parse(await getJson(config, `/api/issues/catalog${queryString({ projectId })}`));
    },
    async searchIssues(projectId: string, query: string) {
      return issueSearchResponseSchema.parse(
        await getJson(config, `/api/issues/search${queryString({ projectId, query })}`),
      );
    },
    async listIssues(params: { projectId?: string } = {}) {
      return issueContractSchema
        .array()
        .parse(await getJson(config, `/api/issues${queryString(params)}`));
    },
    async createIssue(request: CreateIssueRequest) {
      return issueContractSchema.parse(await postJson(config, "/api/issues", request));
    },
    async moveIssueProject(id: string, request: MoveIssueProjectRequest) {
      return issueContractSchema.parse(
        await patchJson(config, `/api/issues/${encodeURIComponent(id)}/project`, request),
      );
    },
    async setIssueStatus(id: string, request: SetIssueStatusRequest) {
      return issueContractSchema.parse(
        await patchJson(config, `/api/issues/${encodeURIComponent(id)}/status`, request),
      );
    },
    async getIssue(id: string) {
      return issueContractSchema.parse(
        await getJson(config, `/api/issues/${encodeURIComponent(id)}`),
      );
    },
  };
}
