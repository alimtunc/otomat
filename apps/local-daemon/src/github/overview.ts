import type { PullRequestImportService } from "./import/service.js";
import { mergeAvailability } from "./merge-availability.js";
import type { GitHubServiceConfig, PullRequestOverviewResult } from "./types.js";

/** The merge policy is never cached: a repository can stop allowing a method between two openings. */
export async function readPullRequestOverview(
  config: GitHubServiceConfig,
  imports: PullRequestImportService,
  pullRequestId: string,
): Promise<PullRequestOverviewResult> {
  const { row, repository, cwd, viewerLogin, facts } = await imports.overview(pullRequestId);
  const policy = await config.cli.readRepositoryMergePolicy({ cwd, repository });
  return {
    row,
    repository,
    cwd,
    facts,
    behindBase: facts.mergeState === "BEHIND",
    merge: mergeAvailability({ row, mergeState: facts.mergeState, policy, viewerLogin }),
  };
}
