import {
  issuePullRequestsSchema,
  pullRequestContractSchema,
  pullRequestDetailSchema,
  pullRequestOverviewSchema,
  pullRequestProposalSchema,
  pullRequestReviewContextSchema,
  repositoryPullRequestPreviewSchema,
  type AttachPullRequestRequest,
  type MergePullRequestRequest,
  type PublishPullRequestRequest,
  type PublishRepositoryPullRequest,
  type PushPullRequestRequest,
  type RepositoryPullRequestInput,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, postJson, queryString } from "./http.js";

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
    async previewRepositoryPullRequest(repositoryId: string, baseRef: string) {
      const id = encodeURIComponent(repositoryId);
      return repositoryPullRequestPreviewSchema.parse(
        await getJson(config, `/api/repositories/${id}/pr${queryString({ base_ref: baseRef })}`),
      );
    },
    async generateRepositoryPullRequest(repositoryId: string, request: RepositoryPullRequestInput) {
      const id = encodeURIComponent(repositoryId);
      return pullRequestProposalSchema.parse(
        await postJson(config, `/api/repositories/${id}/pr/generate`, request),
      );
    },
    async publishRepositoryPullRequest(
      repositoryId: string,
      request: PublishRepositoryPullRequest,
    ) {
      const id = encodeURIComponent(repositoryId);
      return pullRequestContractSchema.parse(
        await postJson(config, `/api/repositories/${id}/pr`, request),
      );
    },
  };
}
