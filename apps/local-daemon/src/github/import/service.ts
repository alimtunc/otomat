import {
  findPullRequestByNumber,
  getAttachedPullRequest,
  listPullRequestsForIssue,
  type PullRequestRow,
} from "@otomat/db";
import type { AttachPullRequestRequest } from "@otomat/domain";

import { fetchPullRequestTrees, type PullRequestTrees } from "#git";

import { failureMessage, PullRequestImportRefusal } from "../errors.js";
import type { GitHubCli, GitHubPullRequest, IssuePullRequestsResult } from "../types.js";
import { detectIssuePullRequests } from "./detect.js";
import { parsePullRequestReference } from "./reference.js";
import { resolveIssueRepository, type IssueRepository } from "./repository.js";
import { applyProviderState, insertAttachedPullRequest, markPullRequestDetached } from "./store.js";
import type { ImportStoreConfig } from "./store.js";
import { buildEvidence, classifyPullRequest } from "./verify.js";

export interface PullRequestImportConfig extends ImportStoreConfig {
  cli: GitHubCli;
}

export interface PullRequestImportService {
  list(issueId: string): Promise<IssuePullRequestsResult>;
  /** Verifies the repository, the base, the head and the state before anything is written. */
  attach(issueId: string, request: AttachPullRequestRequest): Promise<PullRequestRow>;
  detach(pullRequestId: string): PullRequestRow;
  /** Re-reads GitHub: a moved head re-pins the review, a merge or a close settles it. */
  refresh(pullRequestId: string): Promise<PullRequestRow>;
}

class DefaultPullRequestImportService implements PullRequestImportService {
  constructor(private readonly config: PullRequestImportConfig) {}

  async list(issueId: string): Promise<IssuePullRequestsResult> {
    // A publication Otomat has not opened yet carries no number, so it is a draft row rather than a pull request to show.
    const attached = listPullRequestsForIssue(this.config.db, issueId).filter(
      (row) => row.number !== null,
    );
    let repository: IssueRepository;
    try {
      repository = await this.repositoryFor(issueId);
    } catch (error) {
      const message =
        error instanceof PullRequestImportRefusal
          ? error.message
          : `GitHub could not be reached: ${failureMessage(error)}`;
      return { attached, candidates: [], detection: { status: "unavailable", message } };
    }
    const detected = await detectIssuePullRequests(
      {
        db: this.config.db,
        cli: this.config.cli,
        connectedLogin: () => this.connectedLogin(),
      },
      issueId,
      repository,
    );
    return { attached, ...detected };
  }

  async attach(issueId: string, request: AttachPullRequestRequest): Promise<PullRequestRow> {
    const reference = parsePullRequestReference(request.reference);
    if (reference === null) {
      throw new PullRequestImportRefusal(
        "pr_reference_invalid",
        `“${request.reference}” is not a pull request number or a github.com pull request URL.`,
      );
    }
    const repository = await this.repositoryFor(issueId);
    if (reference.repository !== null && reference.repository !== repository.remote.repository) {
      throw new PullRequestImportRefusal(
        "pr_repository_mismatch",
        `That pull request belongs to ${reference.repository}, but this issue's repository is ${repository.remote.repository}.`,
      );
    }
    const existing = findPullRequestByNumber(
      this.config.db,
      repository.binding.repositoryId,
      reference.number,
    );
    if (existing) {
      throw new PullRequestImportRefusal(
        "pr_already_attached",
        `Pull request #${reference.number} is already tracked here.`,
      );
    }

    const provider = await this.view(repository, reference.number);
    const connectedLogin = await this.connectedLogin();
    const verdict = classifyPullRequest(this.config.db, {
      issueId,
      repositoryId: repository.binding.repositoryId,
      provider,
      connectedLogin,
    });
    return insertAttachedPullRequest(this.config, {
      issueId,
      repositoryId: repository.binding.repositoryId,
      provider,
      provenance: verdict.provenance,
      evidence: buildEvidence(repository.remote.repository, provider, "manual"),
      attachedBy: connectedLogin,
      trees: this.fetchTrees(repository, provider),
    });
  }

  detach(pullRequestId: string): PullRequestRow {
    const row = this.require(pullRequestId);
    if (row.origin !== "imported") {
      throw new PullRequestImportRefusal(
        "pr_not_attached",
        "Otomat opened this pull request itself, so there is no attachment to remove.",
      );
    }
    return markPullRequestDetached(this.config, row);
  }

  async refresh(pullRequestId: string): Promise<PullRequestRow> {
    const row = this.require(pullRequestId);
    if (row.number === null) {
      throw new PullRequestImportRefusal(
        "pr_not_found",
        "This pull request has no number on GitHub yet, so there is nothing to refresh.",
      );
    }
    const repository = await this.repositoryFor(row.issue_id);
    const provider = await this.view(repository, row.number);
    const verdict = classifyPullRequest(this.config.db, {
      issueId: row.issue_id,
      repositoryId: repository.binding.repositoryId,
      provider,
      connectedLogin: await this.connectedLogin(),
    });
    return applyProviderState(
      this.config,
      row,
      provider,
      verdict.provenance,
      this.fetchTrees(repository, provider),
    );
  }

  private require(pullRequestId: string): PullRequestRow {
    const row = getAttachedPullRequest(this.config.db, pullRequestId);
    if (!row) {
      throw new PullRequestImportRefusal(
        "pr_not_found",
        `Pull request ${pullRequestId} is not attached here.`,
      );
    }
    return row;
  }

  private repositoryFor(issueId: string): Promise<IssueRepository> {
    return resolveIssueRepository(this.config, issueId);
  }

  /** Isolation is the fetch itself: the head lands in a read-only ref, so review holds no branch it could push. */
  private fetchTrees(repository: IssueRepository, provider: GitHubPullRequest): PullRequestTrees {
    try {
      return fetchPullRequestTrees({
        repoRoot: repository.binding.rootPath,
        remote: repository.remote.name,
        number: provider.number,
        baseRef: provider.baseRef,
      });
    } catch (error) {
      throw new PullRequestImportRefusal(
        "pr_lookup_failed",
        `The pull request head could not be fetched: ${failureMessage(error)}`,
      );
    }
  }

  private async view(repository: IssueRepository, number: number): Promise<GitHubPullRequest> {
    try {
      return await this.config.cli.viewPullRequest(
        repository.binding.rootPath,
        repository.remote.repository,
        number,
      );
    } catch (error) {
      throw new PullRequestImportRefusal(
        "pr_not_found",
        `GitHub could not read ${repository.remote.repository}#${number}: ${failureMessage(error)}`,
      );
    }
  }

  private async connectedLogin(): Promise<string | null> {
    const connection = await this.config.cli.connection();
    return connection.status === "connected" ? connection.login : null;
  }
}

export function createPullRequestImportService(
  config: PullRequestImportConfig,
): PullRequestImportService {
  return new DefaultPullRequestImportService(config);
}
