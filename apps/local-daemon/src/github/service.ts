import { randomUUID } from "node:crypto";

import { createGitHubConnectionService } from "./connection.js";
import { createDeviceAuthorization } from "./device-flow.js";
import { resolveGenerationAgent } from "./generation/agent.js";
import { createPullRequestImportService } from "./import/service.js";
import { createPullRequestInboxService } from "./inbox/index.js";
import { pullRequestIssue } from "./issue-link.js";
import { mergePullRequest } from "./merge.js";
import { readPullRequestOverview } from "./overview.js";
import { createPullRequestPublisher } from "./publication/index.js";
import { refreshTrackedPullRequests } from "./refresh.js";
import { generateRepositoryProposal } from "./repository/generation.js";
import { publishRepositoryPullRequest } from "./repository/publication.js";
import {
  prepareRepositoryPublication,
  previewRepositoryPullRequest,
} from "./repository/workspace.js";
import { submitPullRequestReview } from "./review-submission.js";
import { serializeByKey } from "./serialize.js";
import type { GitHubService, GitHubServiceConfig } from "./types.js";
import { readViewedFiles, syncViewedFile } from "./viewed-files.js";

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const normalizedConfig = { ...config, idFactory: config.idFactory ?? randomUUID };
  const connection = createGitHubConnectionService(config.cli, createDeviceAuthorization());
  const publisher = createPullRequestPublisher(normalizedConfig, config.generator);
  const imports = createPullRequestImportService(normalizedConfig);
  const inbox = createPullRequestInboxService(normalizedConfig);
  const repositoryPublications = new Map<string, Promise<unknown>>();
  const inRepository = <T>(repositoryId: string, operation: () => Promise<T>): Promise<T> =>
    serializeByKey(repositoryPublications, repositoryId, operation);
  return {
    ...connection,
    pullRequestInbox: (projectId) => inbox.read(projectId),
    syncPullRequestInbox: (projectId) => inbox.sync(projectId),
    listIssuePullRequests: (issueId) => imports.list(issueId),
    attachPullRequest: async (issueId, request) => {
      const row = await imports.attach(issueId, request);
      config.importViewedFiles?.(row.id);
      return row;
    },
    detachPullRequest: (pullRequestId) => imports.detach(pullRequestId),
    pullRequestIssue: (row) => pullRequestIssue(config.db, row),
    refreshPullRequest: async (pullRequestId) => {
      const row = await imports.refresh(pullRequestId);
      config.importViewedFiles?.(pullRequestId);
      return row;
    },
    refreshTrackedPullRequests: () =>
      refreshTrackedPullRequests({ db: config.db, publisher, imports }),
    getPullRequest: (runId) => publisher.get(runId),
    publishability: (runId) => publisher.publishability(runId),
    publish: (run, request) => publisher.publish(run, request),
    previewRepositoryPullRequest: (repositoryId, baseRef) =>
      previewRepositoryPullRequest(config, repositoryId, baseRef),
    generateRepositoryPullRequest: (repositoryId, request) =>
      inRepository(repositoryId, async () =>
        generateRepositoryProposal(
          config,
          await prepareRepositoryPublication(config, repositoryId, request),
        ),
      ),
    publishRepositoryPullRequest: (repositoryId, request) =>
      inRepository(repositoryId, () =>
        publishRepositoryPullRequest(normalizedConfig, repositoryId, request),
      ),
    reconcileInterruptedPublications: () => publisher.reconcileInterrupted(),
    settlePublications: () => publisher.settle(),
    pushCommits: (runId, request) => publisher.pushCommits(runId, request),
    submitPullRequestReview: (pullRequestId, input) =>
      submitPullRequestReview(config, pullRequestId, input),
    pullRequestOverview: (pullRequestId) => readPullRequestOverview(config, imports, pullRequestId),
    mergePullRequest: (pullRequestId, method) =>
      mergePullRequest(config, imports, pullRequestId, method),
    readViewedFiles: (pullRequestId) => readViewedFiles(config, pullRequestId),
    syncViewedFile: (pullRequestId, input) => syncViewedFile(config, pullRequestId, input),
    // Resolved before the run is reached: an unavailable runtime or model refuses here rather than in the CLI.
    generatePullRequestMetadata: (run) =>
      publisher.generate(run, resolveGenerationAgent(config.db, run)),
  };
}
