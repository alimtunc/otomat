import type { PullRequestImportService, PullRequestOverviewRead } from "./import/service.js";
import { mergeAvailability } from "./merge-availability.js";
import type { GitHubServiceConfig, PullRequestOverviewResult } from "./types.js";

/** The merge policy is never cached: a repository can stop allowing a method between two openings. */
export async function readPullRequestOverview(
  config: GitHubServiceConfig,
  imports: PullRequestImportService,
  pullRequestId: string,
): Promise<PullRequestOverviewResult> {
  const read: PullRequestOverviewRead = await imports.overview(pullRequestId);
  const { row, facts } = read;
  const policy = await config.cli.readRepositoryMergePolicy({
    cwd: read.cwd,
    repository: read.repository,
  });
  return {
    row,
    repository: read.repository,
    checks: facts.checks,
    reviews: facts.reviews,
    commits: facts.commits,
    changedFiles: facts.changedFiles,
    additions: facts.additions,
    deletions: facts.deletions,
    behindBase: facts.mergeState === "BEHIND",
    merge: mergeAvailability({
      row,
      mergeState: facts.mergeState,
      policy,
      viewerLogin: read.viewerLogin,
    }),
  };
}
