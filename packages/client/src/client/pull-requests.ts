import {
  issuePullRequestsSchema,
  pullRequestContractSchema,
  pullRequestDetailSchema,
  pullRequestOverviewSchema,
  pullRequestProposalSchema,
  pullRequestReviewContextSchema,
  type AttachPullRequestRequest,
  type MergePullRequestRequest,
  type PublishPullRequestRequest,
  type PushPullRequestRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, postJson } from "./http.js";

export function createPullRequestsClient(config: DaemonClientConfig) {
  return {
    async getPullRequest(id: string) {
      return pullRequestDetailSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/pr`),
      );
    },
    async publishPullRequest(id: string, request: PublishPullRequestRequest) {
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
    async listIssuePullRequests(issueId: string) {
      const issue = encodeURIComponent(issueId);
      return issuePullRequestsSchema.parse(
        await getJson(config, `/api/issues/${issue}/pull-requests`),
      );
    },
    async attachPullRequest(issueId: string, request: AttachPullRequestRequest) {
      const issue = encodeURIComponent(issueId);
      return pullRequestContractSchema.parse(
        await postJson(config, `/api/issues/${issue}/pull-requests`, request),
      );
    },
    async getPullRequestReviewContext(pullRequestId: string) {
      const id = encodeURIComponent(pullRequestId);
      return pullRequestReviewContextSchema.parse(
        await getJson(config, `/api/pull-requests/${id}`),
      );
    },
    async getPullRequestOverview(pullRequestId: string) {
      const id = encodeURIComponent(pullRequestId);
      return pullRequestOverviewSchema.parse(
        await getJson(config, `/api/pull-requests/${id}/overview`),
      );
    },
    async mergePullRequest(pullRequestId: string, request: MergePullRequestRequest) {
      const id = encodeURIComponent(pullRequestId);
      return pullRequestReviewContextSchema.parse(
        await postJson(config, `/api/pull-requests/${id}/merge`, request),
      );
    },
    async refreshPullRequest(pullRequestId: string) {
      const id = encodeURIComponent(pullRequestId);
      return pullRequestReviewContextSchema.parse(
        await postJson(config, `/api/pull-requests/${id}/refresh`, {}),
      );
    },
    async detachPullRequest(pullRequestId: string) {
      await deleteJson(config, `/api/pull-requests/${encodeURIComponent(pullRequestId)}`);
    },
  };
}
