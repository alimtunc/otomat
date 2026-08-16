import { randomUUID } from "node:crypto";

import { createGitHubConnectionService } from "./connection.js";
import { createDeviceAuthorization } from "./device-flow.js";
import { resolveGenerationAgent } from "./generation/agent.js";
import { createPullRequestPublisher } from "./publication/index.js";
import { publishReviewComment } from "./review-comment.js";
import type { GitHubService, GitHubServiceConfig } from "./types.js";

export { GitHubPublicationError } from "./errors.js";

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const normalizedConfig = { ...config, idFactory: config.idFactory ?? randomUUID };
  const connection = createGitHubConnectionService(config.cli, createDeviceAuthorization());
  const publisher = createPullRequestPublisher(normalizedConfig, config.generator);
  return {
    ...connection,
    getPullRequest: (runId) => publisher.get(runId),
    publishability: (runId) => publisher.publishability(runId),
    publish: (run, request) => publisher.publish(run, request),
    pushCommits: (runId, request) => publisher.pushCommits(runId, request),
    publishReviewComment: (runId, input) => publishReviewComment(config, runId, input),
    // Resolved before the run is reached: an unavailable runtime or model refuses here rather than in the CLI.
    generatePullRequestMetadata: (run) =>
      publisher.generate(run, resolveGenerationAgent(config.db, run)),
  };
}
