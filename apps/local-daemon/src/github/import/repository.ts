import { getIssue, type Db, type PullRequestRow } from "@otomat/db";

import type { RepositoryBinding, RepositoryResolver } from "#git";

import { failureMessage, PullRequestImportRefusal } from "../errors.js";
import type { GitHubCli, GitHubRemote } from "../types.js";

export interface IssueRepositoryConfig {
  db: Db;
  repositories: RepositoryResolver;
  cli: GitHubCli;
}

/** A local repository a pull request is verified against, plus the GitHub remote that names it. */
export interface IssueRepository {
  binding: RepositoryBinding;
  remote: GitHubRemote;
}

export async function resolveRepositoryRemote(
  config: IssueRepositoryConfig,
  binding: RepositoryBinding,
): Promise<IssueRepository> {
  try {
    return { binding, remote: await config.cli.resolveRemote(binding.rootPath) };
  } catch (error) {
    throw new PullRequestImportRefusal(
      "pr_repository_missing",
      `This repository has no usable GitHub remote: ${failureMessage(error)}`,
    );
  }
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
  return resolveRepositoryRemote(config, binding);
}

/** A mirrored row names its own repository; an early publication may not, and then its issue answers for it. */
export async function resolvePullRequestRepository(
  config: IssueRepositoryConfig,
  row: PullRequestRow,
): Promise<IssueRepository> {
  const binding = config.repositories.forRepository(row.repository_id);
  if (binding !== null) return resolveRepositoryRemote(config, binding);
  if (row.issue_id === null) {
    throw new PullRequestImportRefusal(
      "pr_repository_missing",
      "This pull request names no repository Otomat has registered, so GitHub cannot be asked about it.",
    );
  }
  return resolveIssueRepository(config, row.issue_id);
}
