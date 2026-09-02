import type { PullRequestRow } from "@otomat/db";
import type { PullRequestMergeMethod } from "@otomat/domain";

import { GitHubPublicationError } from "./errors.js";
import type { PullRequestImportService } from "./import/service.js";
import { readPullRequestOverview } from "./overview.js";
import { pullRequestCwd } from "./pull-request-cwd.js";
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
  const { row } = overview;
  if (row.number === null) {
    throw new GitHubPublicationError("merge_unavailable", "This pull request has no number yet.");
  }
  await config.cli.mergePullRequest({
    cwd: pullRequestCwd(config, row),
    repository: overview.repository,
    number: row.number,
    method,
  });
  // The refresh is what lands `merged` on the row, and landing it is what closes the cycle.
  return imports.refresh(pullRequestId);
}
