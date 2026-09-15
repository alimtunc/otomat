import {
  sourceControlResponseSchema,
  pullRequestContractSchema,
  type PublishRepositoryPullRequest,
  type RepositoryPullRequestInput,
  repositoryPullRequestPreviewSchema,
  pullRequestProposalSchema,
  commitFilesResponseSchema,
  type CommitFilesRequest,
  type ChangeFilesRequest,
  type CheckoutTarget,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson } from "./http.js";

function checkoutPath(target: CheckoutTarget): string {
  return `/api/source-control/${target.kind}/${encodeURIComponent(target.id)}`;
}

export function createSourceControlClient(config: DaemonClientConfig) {
  return {
    async previewRepositoryPullRequest(repositoryId: string, baseRef: string) {
      return repositoryPullRequestPreviewSchema.parse(
        await getJson(
          config,
          `/api/repositories/${encodeURIComponent(repositoryId)}/pr?base_ref=${encodeURIComponent(baseRef)}`,
        ),
      );
    },
    async generateRepositoryPullRequest(repositoryId: string, request: RepositoryPullRequestInput) {
      return pullRequestProposalSchema.parse(
        await postJson(
          config,
          `/api/repositories/${encodeURIComponent(repositoryId)}/pr/generate`,
          request,
        ),
      );
    },
    async publishRepositoryPullRequest(
      repositoryId: string,
      request: PublishRepositoryPullRequest,
    ) {
      return pullRequestContractSchema.parse(
        await postJson(config, `/api/repositories/${encodeURIComponent(repositoryId)}/pr`, request),
      );
    },
    async getSourceControl(target: CheckoutTarget) {
      return sourceControlResponseSchema.parse(await getJson(config, checkoutPath(target)));
    },
    async changeFiles(target: CheckoutTarget, request: ChangeFilesRequest): Promise<void> {
      await postJson(config, checkoutPath(target), request);
    },
    async commitFiles(target: CheckoutTarget, request: CommitFilesRequest) {
      return commitFilesResponseSchema.parse(
        await postJson(config, `${checkoutPath(target)}/commit`, request),
      );
    },
  };
}
