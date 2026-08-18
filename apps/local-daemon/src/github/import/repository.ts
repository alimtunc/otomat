import { getIssue, type Db } from "@otomat/db";

import type { RepositoryBinding, RepositoryResolver } from "#git";

import { failureMessage, PullRequestImportRefusal } from "../errors.js";
import type { GitHubCli, GitHubRemote } from "../types.js";

export interface IssueRepositoryConfig {
  db: Db;
  repositories: RepositoryResolver;
  cli: GitHubCli;
}

/** The local repository an issue's pull requests are verified against, plus the GitHub remote that names it. */
export interface IssueRepository {
  binding: RepositoryBinding;
  remote: GitHubRemote;
}

export async function resolveIssueRepository(
  config: IssueRepositoryConfig,
  issueId: string,
): Promise<IssueRepository> {
  const issue = getIssue(config.db, issueId);
  if (!issue) throw new PullRequestImportRefusal("pr_not_found", `Issue ${issueId} is unknown.`);
  const binding = config.repositories.forProject(issue.project_id);
  if (binding === null) {
    throw new PullRequestImportRefusal(
      "pr_repository_missing",
      "This issue's project has no registered repository, so a pull request cannot be verified against it.",
    );
  }
  try {
    return { binding, remote: await config.cli.resolveRemote(binding.rootPath) };
  } catch (error) {
    throw new PullRequestImportRefusal(
      "pr_repository_missing",
      `This repository has no usable GitHub remote: ${failureMessage(error)}`,
    );
  }
}
