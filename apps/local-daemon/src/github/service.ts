import { randomUUID } from "node:crypto";

import { createGitHubConnectionService } from "./connection.js";
import { createDeviceAuthorization } from "./device-flow.js";
import { buildPullRequestDraftInput } from "./draft.js";
import { GitHubPublicationError } from "./errors.js";
import { createPullRequestPublisher } from "./publication/index.js";
import type { GitHubService, GitHubServiceConfig } from "./types.js";

export { GitHubPublicationError } from "./errors.js";

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  const normalizedConfig = { ...config, idFactory: config.idFactory ?? randomUUID };
  const connection = createGitHubConnectionService(config.cli, createDeviceAuthorization());
  const publisher = createPullRequestPublisher(normalizedConfig);
  return {
    ...connection,
    getPullRequest: (runId) => publisher.get(runId),
    publish: (run, request) => publisher.publish(run, request),
    draftPullRequest: (run) => {
      const drafter = config.drafter;
      if (drafter === undefined) {
        throw new GitHubPublicationError(
          "pr_draft_failed",
          "Drafting is not available on this daemon.",
        );
      }
      return drafter.draft(buildPullRequestDraftInput(config, run));
    },
  };
}
