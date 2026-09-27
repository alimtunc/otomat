import { getAttachedPullRequest } from "@otomat/db";
import type { PullRequestStackContext, PullRequestStackMember } from "@otomat/domain";

import type { GitHubPullRequest } from "./cli/contract.js";
import { PullRequestImportRefusal } from "./errors.js";
import { resolvePullRequestRepository } from "./import/repository.js";
import type { GitHubServiceConfig } from "./types.js";

function toStackMember(provider: GitHubPullRequest): PullRequestStackMember {
  return {
    number: provider.number,
    title: provider.title,
    url: provider.url,
    status: provider.lifecycle,
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
  };
}

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
  const current =
    stack?.members.find((member) => member.number === row.number) ??
    toStackMember(await config.cli.viewPullRequest(input.cwd, input.repository, input.number));
  return { current, stack, checked_at: new Date().toISOString() };
}
