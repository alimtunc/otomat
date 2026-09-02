import {
  findPullRequestByNumber,
  getAttachedPullRequest,
  listPullRequestsForIssue,
  type PullRequestRow,
} from "@otomat/db";
import type { AttachPullRequestRequest } from "@otomat/domain";

import type { GitHubCli, GitHubPullRequest, PullRequestOverviewFacts } from "../cli/contract.js";
import { failureMessage, PullRequestImportRefusal } from "../errors.js";
import type { IssuePullRequestsResult } from "../types.js";
import { detectIssuePullRequests } from "./detect.js";
import { connectedLogin, fetchHeadTrees, readPullRequest, readOverviewFacts } from "./read.js";
import { parsePullRequestReference } from "./reference.js";
import {
  resolveIssueRepository,
  resolvePullRequestRepository,
  type IssueRepository,
} from "./repository.js";
import { applyProviderState, insertMirroredPullRequest, markPullRequestDetached } from "./store.js";
import type { ImportStoreConfig } from "./store.js";
import { buildEvidence, classifyPullRequest } from "./verify.js";

export interface PullRequestImportConfig extends ImportStoreConfig {
  cli: GitHubCli;
}

export interface PullRequestOverviewRead {
  row: PullRequestRow;
  repository: string;
  /** Checkout the read ran from; the merge policy is asked for from the same place. */
  cwd: string;
  /** The identity that classified this read, reused so the merge authority rests on one answer. */
  viewerLogin: string | null;
  facts: PullRequestOverviewFacts;
}

interface LivePullRequest {
  row: PullRequestRow;
  number: number;
  repository: IssueRepository;
}

export interface PullRequestImportService {
  list(issueId: string): Promise<IssuePullRequestsResult>;
  /** Verifies the repository, the base, the head and the state before anything is written. */
  attach(issueId: string, request: AttachPullRequestRequest): Promise<PullRequestRow>;
  detach(pullRequestId: string): PullRequestRow;
  /** Re-reads GitHub: a moved head re-pins the review, a merge or a close settles it. */
  refresh(pullRequestId: string): Promise<PullRequestRow>;
  /** The same re-read with the facts the mirror does not keep — commits, per-check results, submitted reviews. */
  overview(pullRequestId: string): Promise<PullRequestOverviewRead>;
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
        connectedLogin: () => connectedLogin(this.config.cli),
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

    const provider = await readPullRequest(this.config.cli, repository, reference.number);
    const login = await connectedLogin(this.config.cli);
    const verdict = classifyPullRequest(this.config.db, {
      repositoryId: repository.binding.repositoryId,
      provider,
      connectedLogin: login,
    });
    return insertMirroredPullRequest(this.config, {
      issueId,
      repositoryId: repository.binding.repositoryId,
      provider,
      provenance: verdict.provenance,
      evidence: buildEvidence(repository.remote.repository, provider, "manual"),
      attachedBy: login,
      trees: fetchHeadTrees(repository, provider),
      syncedAt: null,
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
    const live = await this.live(pullRequestId);
    const provider = await readPullRequest(this.config.cli, live.repository, live.number);
    return this.mirror(live.row, live.repository, provider, await connectedLogin(this.config.cli));
  }

  async overview(pullRequestId: string): Promise<PullRequestOverviewRead> {
    const live = await this.live(pullRequestId);
    const facts = await readOverviewFacts(this.config.cli, live.repository, live.number);
    const viewerLogin = await connectedLogin(this.config.cli);
    return {
      row: await this.mirror(live.row, live.repository, facts.pullRequest, viewerLogin),
      repository: live.repository.remote.repository,
      cwd: live.repository.binding.rootPath,
      viewerLogin,
      facts,
    };
  }

  private async live(pullRequestId: string): Promise<LivePullRequest> {
    const row = this.require(pullRequestId);
    if (row.number === null) {
      throw new PullRequestImportRefusal(
        "pr_not_found",
        "This pull request has no number on GitHub yet, so there is nothing to read.",
      );
    }
    return {
      row,
      number: row.number,
      repository: await resolvePullRequestRepository(this.config, row),
    };
  }

  private mirror(
    row: PullRequestRow,
    repository: IssueRepository,
    provider: GitHubPullRequest,
    login: string | null,
  ): PullRequestRow {
    const verdict = classifyPullRequest(this.config.db, {
      repositoryId: repository.binding.repositoryId,
      provider,
      connectedLogin: login,
    });
    return applyProviderState(this.config, row, {
      provider,
      provenance: verdict.provenance,
      trees: fetchHeadTrees(repository, provider),
      syncedAt: null,
    });
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
}

export function createPullRequestImportService(
  config: PullRequestImportConfig,
): PullRequestImportService {
  return new DefaultPullRequestImportService(config);
}
