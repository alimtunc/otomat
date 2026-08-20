import type { PullRequestRow } from "@otomat/db";

import { GitHubPublicationError } from "./errors.js";
import type { GitHubServiceConfig } from "./types.js";

/** The checkout a `gh` call runs from: the run's own worktree when it holds one, else the repository root. */
export function pullRequestCwd(config: GitHubServiceConfig, pullRequest: PullRequestRow): string {
  const binding =
    pullRequest.run_id === null
      ? config.repositories.forRepository(pullRequest.repository_id)
      : config.repositories.forRun(pullRequest.run_id);
  const worktree =
    pullRequest.run_id === null ? undefined : binding?.service.get(pullRequest.run_id);
  const cwd = worktree?.path ?? binding?.rootPath;
  if (cwd === undefined) {
    throw new GitHubPublicationError(
      "worktree_missing",
      "This pull request has no repository checkout to reach GitHub from.",
    );
  }
  return cwd;
}
