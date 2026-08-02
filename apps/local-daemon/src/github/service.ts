import { randomUUID } from "node:crypto";

import { createGitHubConnectionService } from "./connection.js";
import { createDeviceAuthorization } from "./device-flow.js";
import { createPullRequestPublisher } from "./publication/index.js";
import type { GitHubService, GitHubServiceConfig } from "./types.js";

export { GitHubPublicationError } from "./errors.js";

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const normalizedConfig = { ...config, idFactory: config.idFactory ?? randomUUID };
  const connection = createGitHubConnectionService(
    config.cli,
    config.deviceAuthorization ?? createDeviceAuthorization(),
  );
  const publisher = createPullRequestPublisher(normalizedConfig);
  return {
    ...connection,
    getPullRequest: (runId) => publisher.get(runId),
    publish: (run, request) => publisher.publish(run, request),
  };
}
