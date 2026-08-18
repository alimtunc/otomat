import { randomUUID } from "node:crypto";

import { createGitHubConnectionService } from "./connection.js";
import { createDeviceAuthorization } from "./device-flow.js";
import { resolveGenerationAgent } from "./generation/agent.js";
import { createPullRequestImportService } from "./import/service.js";
import { createPullRequestPublisher } from "./publication/index.js";
import { publishReviewComment } from "./review-comment.js";
import type { GitHubService, GitHubServiceConfig } from "./types.js";

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const normalizedConfig = { ...config, idFactory: config.idFactory ?? randomUUID };
  const connection = createGitHubConnectionService(config.cli, createDeviceAuthorization());
  const publisher = createPullRequestPublisher(normalizedConfig, config.generator);
  const imports = createPullRequestImportService(normalizedConfig);
  return {
    ...connection,
    listIssuePullRequests: (issueId) => imports.list(issueId),
    attachPullRequest: (issueId, request) => imports.attach(issueId, request),
    detachPullRequest: (pullRequestId) => imports.detach(pullRequestId),
    refreshPullRequest: (pullRequestId) => imports.refresh(pullRequestId),
    getPullRequest: (runId) => publisher.get(runId),
    publishability: (runId) => publisher.publishability(runId),
    publish: (run, request) => publisher.publish(run, request),
    pushCommits: (runId, request) => publisher.pushCommits(runId, request),
    publishReviewComment: (pullRequestId, input) =>
      publishReviewComment(config, pullRequestId, input),
    // Resolved before the run is reached: an unavailable runtime or model refuses here rather than in the CLI.
    generatePullRequestMetadata: (run) =>
      publisher.generate(run, resolveGenerationAgent(config.db, run)),
  };
}
