import type { PullRequestRow } from "@otomat/db";
import type { PullRequestMergeMethod } from "@otomat/domain";

import { failureMessage, GitHubPublicationError } from "./errors.js";
import type { PullRequestImportService } from "./import/service.js";
import { readPullRequestOverview } from "./overview.js";
import type { GitHubServiceConfig } from "./types.js";

/** The authority and the state are re-read because the reviewer's Overview may be minutes old. */
export async function mergePullRequest(
  config: GitHubServiceConfig,
  imports: PullRequestImportService,
  pullRequestId: string,
  method: PullRequestMergeMethod,
): Promise<PullRequestRow> {
  const overview = await readPullRequestOverview(config, imports, pullRequestId);
  if (overview.merge.blocker !== null) {
    throw new GitHubPublicationError("merge_unavailable", overview.merge.reason);
  }
  if (!overview.merge.methods.includes(method)) {
    const allowed = overview.merge.methods.join(" or ");
    throw new GitHubPublicationError(
      "merge_unavailable",
      `${overview.repository} does not allow a ${method} merge; it allows ${allowed}.`,
    );
  }
  const { number } = overview.facts.pullRequest;
  await config.cli.mergePullRequest({
    cwd: overview.cwd,
    repository: overview.repository,
    number,
    method,
  });
  // The refresh is what lands `merged` on the row, and landing it is what closes the cycle.
  try {
    return await imports.refresh(pullRequestId);
  } catch (error) {
    throw new GitHubPublicationError(
      "merge_refresh_failed",
      `GitHub merged #${number}, but the mirror could not be refreshed: ${failureMessage(error)}`,
    );
  }
}
