import { getAttachedPullRequest } from "@otomat/db";
import type { PullRequestStackContext } from "@otomat/domain";

import { PullRequestImportRefusal } from "./errors.js";
import { resolvePullRequestRepository } from "./import/repository.js";
import type { GitHubServiceConfig } from "./types.js";

export async function readStackContext(
  config: GitHubServiceConfig,
  pullRequestId: string,
): Promise<PullRequestStackContext> {
  const row = getAttachedPullRequest(config.db, pullRequestId);
  if (!row || row.number === null)
    throw new PullRequestImportRefusal("pr_not_found", "This pull request is not published.");
  const { binding, remote } = await resolvePullRequestRepository(config, row);
  const input = { cwd: binding.rootPath, repository: remote.repository, number: row.number };
  const stack = await config.cli.readPullRequestStack(input);
  const member = stack?.members.find((item) => item.number === row.number);
  if (member !== undefined) return { current: member, stack, checked_at: new Date().toISOString() };
  const provider = await config.cli.viewPullRequest(input.cwd, input.repository, input.number);
  return {
    current: {
      number: provider.number,
      title: provider.title,
      url: provider.url,
      status: provider.lifecycle,
      head_ref: provider.headRef,
      base_ref: provider.baseRef,
    },
    stack,
    checked_at: new Date().toISOString(),
  };
}
