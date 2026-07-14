import {
  getPullRequestForRun,
  getRepository,
  insertPullRequest,
  updatePullRequest,
  type PullRequestPatch,
  type PullRequestRow,
  type RunRow,
} from "@otomat/db";
import {
  drivePath,
  pullRequestMachine,
  pullRequestPublicationMachine,
  type EventSource,
  type GitHubConnectionContract,
  type PreparePullRequestRequest,
  type PullRequestPublicationState,
  type PullRequestState,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import type { WorktreeRecord } from "#git";

import { normalizePullRequestBody } from "./body.js";
import { GitHubPublicationError, safeGitHubFailure } from "./errors.js";
import { buildPullRequestEvent, type PullRequestEventType } from "./events.js";
import type {
  GitHubPullRequest,
  GitHubRemote,
  GitHubServiceConfig,
  PullRequestSelector,
  PullRequestView,
} from "./types.js";

type PublicationConfig = Omit<GitHubServiceConfig, "idFactory"> & { idFactory: () => string };

interface PullRequestPublicationService {
  get(runId: string): PullRequestView | null;
  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView>;
}

interface ExistingPullRequestResult {
  row: PullRequestRow;
  completedView: PullRequestView | null;
  provider: GitHubPullRequest | null;
}

interface PushedSnapshot {
  row: PullRequestRow;
  headSha: string;
  diffSha: string;
  selector: PullRequestSelector;
}

interface ProviderResult {
  row: PullRequestRow;
  provider: GitHubPullRequest;
}

interface PublicationRequest extends PreparePullRequestRequest {
  normalizedBody: string | null;
}

interface PublicationContext {
  run: RunRow;
  worktree: WorktreeRecord;
  remote: GitHubRemote;
  request: PublicationRequest;
}

function providerPatch(
  provider: GitHubPullRequest,
  snapshot: { headSha: string; diffSha: string },
): PullRequestPatch {
  return {
    provider: "github",
    number: provider.number,
    url: provider.url,
    title: provider.title,
    body: normalizePullRequestBody(provider.body),
    head_ref: provider.headRef,
    base_ref: provider.baseRef,
    published_head_sha: snapshot.headSha,
    published_diff_sha: snapshot.diffSha,
    error_code: null,
    error_message: null,
  };
}

class PullRequestPublisher implements PullRequestPublicationService {
  private readonly publications = new Map<string, Promise<PullRequestView>>();

  constructor(private readonly config: PublicationConfig) {}

  get(runId: string): PullRequestView | null {
    let row = getPullRequestForRun(this.config.db, runId);
    if (row && !this.publications.has(runId)) row = this.recoverInterrupted(row);
    return row ? this.view(row) : null;
  }

  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView> {
    const active = this.publications.get(run.id);
    if (active) return active;
    const operation = this.publishOnce(run, request).finally(() =>
      this.publications.delete(run.id),
    );
    this.publications.set(run.id, operation);
    return operation;
  }

  private reload(runId: string): PullRequestRow {
    const row = getPullRequestForRun(this.config.db, runId);
    if (!row) throw new Error(`pull request for run ${runId} vanished`);
    return row;
  }

  private ensureRow(runId: string, title: string, body: string | null): PullRequestRow {
    const existing = getPullRequestForRun(this.config.db, runId);
    if (existing) return existing;
    try {
      insertPullRequest(this.config.db, {
        id: this.config.idFactory(),
        run_id: runId,
        provider: "github",
        status: "draft",
        publication_status: "not_configured",
        title,
        body,
      });
    } catch (error) {
      const raced = getPullRequestForRun(this.config.db, runId);
      if (!raced) throw error;
      return raced;
    }
    return this.reload(runId);
  }

  private patch(
    row: PullRequestRow,
    values: PullRequestPatch,
    source: EventSource,
    type: PullRequestEventType = "pr.updated",
  ): PullRequestRow {
    updatePullRequest(this.config.db, row.id, values);
    const updated = this.reload(row.run_id);
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      row.run_id,
      buildPullRequestEvent(row.run_id, type, source, updated, new Date().toISOString()),
    );
    return updated;
  }

  private transition(
    row: PullRequestRow,
    status: PullRequestPublicationState,
    values: PullRequestPatch,
    source: EventSource,
    type: PullRequestEventType = "pr.updated",
  ): PullRequestRow {
    if (row.publication_status !== status) {
      pullRequestPublicationMachine.transition(row.publication_status, status);
    }
    return this.patch(row, { ...values, publication_status: status }, source, type);
  }

  private reconcileLifecycle(row: PullRequestRow, status: PullRequestState): PullRequestRow {
    let current = row;
    drivePath(pullRequestMachine, row.status, status, (next) => {
      current = this.patch(current, { status: next }, "github");
    });
    return current;
  }

  private reconcilePublication(
    row: PullRequestRow,
    status: PullRequestPublicationState,
  ): PullRequestRow {
    let current = row;
    drivePath(pullRequestPublicationMachine, row.publication_status, status, (next) => {
      current = this.patch(
        current,
        { publication_status: next, error_code: null, error_message: null },
        "github",
      );
    });
    return current;
  }

  private failure(row: PullRequestRow, error: unknown): PullRequestRow {
    const failure = safeGitHubFailure(error);
    return this.transition(
      row,
      "failed",
      { error_code: failure.code, error_message: failure.message },
      "github",
    );
  }

  private recoverInterrupted(row: PullRequestRow): PullRequestRow {
    if (row.publication_status !== "pushing" && row.publication_status !== "creating") return row;
    return this.failure(
      row,
      new GitHubPublicationError(
        "github_publication_interrupted",
        "The previous GitHub publication was interrupted. Retry to reconcile it safely.",
      ),
    );
  }

  private view(row: PullRequestRow): PullRequestView {
    let hasUnpublishedChanges: boolean | null = false;
    if (row.published_diff_sha && !this.config.worktrees) {
      hasUnpublishedChanges = null;
    } else if (row.published_diff_sha && this.config.worktrees) {
      try {
        hasUnpublishedChanges =
          this.config.worktrees.diff(row.run_id).sha !== row.published_diff_sha;
      } catch {
        hasUnpublishedChanges = null;
      }
    }
    return { row, hasUnpublishedChanges };
  }

  private requireWorktree(runId: string): WorktreeRecord {
    const worktrees = this.config.worktrees;
    if (!worktrees) {
      throw new GitHubPublicationError("worktree_missing", "The run has no active worktree.");
    }
    const worktree = worktrees.get(runId);
    if (!worktree) {
      throw new GitHubPublicationError("worktree_missing", "The run has no active worktree.");
    }
    const diff = worktrees.diff(runId);
    if (diff.files.length === 0) {
      throw new GitHubPublicationError("diff_empty", "The run has no changes to publish.");
    }
    return worktree;
  }

  private async refreshExisting(
    row: PullRequestRow,
    context: PublicationContext,
  ): Promise<ExistingPullRequestResult> {
    if (row.number === null || row.url === null) {
      return { row, completedView: null, provider: null };
    }
    const provider = await this.config.cli.viewPullRequest(
      context.worktree.path,
      context.remote.repository,
      row.number,
    );
    row = this.reconcileLifecycle(row, provider.lifecycle);
    const hasPublishedSnapshot = row.published_head_sha !== null && row.published_diff_sha !== null;
    if (hasPublishedSnapshot) row = this.reconcilePublication(row, "created");
    if (provider.lifecycle === "merged" || provider.lifecycle === "closed") {
      row = this.patch(
        row,
        {
          head_ref: provider.headRef,
          base_ref: provider.baseRef,
          error_code: null,
          error_message: null,
        },
        "github",
      );
      return { row, completedView: this.view(row), provider };
    }
    const current = this.view(row);
    const metadataChanged =
      provider.title !== context.request.title ||
      normalizePullRequestBody(provider.body) !== context.request.normalizedBody;
    return {
      row,
      completedView:
        hasPublishedSnapshot && current.hasUnpublishedChanges === false && !metadataChanged
          ? current
          : null,
      provider,
    };
  }

  private async pushSnapshot(row: PullRequestRow, context: PublicationContext) {
    row = this.transition(
      row,
      "pushing",
      {
        title: context.request.title,
        body: context.request.normalizedBody,
        error_code: null,
        error_message: null,
      },
      "git",
    );
    const snapshot = this.config.worktrees?.snapshot(context.run.id);
    const diff = this.config.worktrees?.diff(context.run.id);
    if (!snapshot || !diff) {
      throw new GitHubPublicationError("worktree_missing", "The run has no active worktree.");
    }
    await this.config.cli.push(context.worktree.path, context.remote.name, context.worktree.branch);
    return {
      row,
      headSha: snapshot.headSha,
      diffSha: diff.sha,
      selector: {
        cwd: context.worktree.path,
        repository: context.remote.repository,
        head: context.worktree.branch,
        base:
          getRepository(this.config.db, context.worktree.repositoryId)?.default_branch ?? "main",
      },
    };
  }

  private async createProvider(
    row: PullRequestRow,
    selector: PullRequestSelector,
    request: PublicationRequest,
  ): Promise<ProviderResult> {
    row = this.transition(row, "creating", {}, "github");
    await this.config.cli.createPullRequest({
      ...selector,
      title: request.title,
      body: request.body,
    });
    const provider = await this.config.cli.findPullRequest(selector);
    if (provider === null) {
      throw new GitHubPublicationError(
        "github_pr_unconfirmed",
        "GitHub did not return the created pull request.",
      );
    }
    return { row, provider };
  }

  private async updateProvider(
    provider: GitHubPullRequest,
    selector: PullRequestSelector,
    request: PublicationRequest,
  ): Promise<GitHubPullRequest> {
    const metadataChanged =
      provider.title !== request.title ||
      normalizePullRequestBody(provider.body) !== request.normalizedBody;
    if (!metadataChanged) return provider;
    await this.config.cli.updatePullRequest({
      cwd: selector.cwd,
      repository: selector.repository,
      number: provider.number,
      title: request.title,
      body: request.body,
    });
    return this.config.cli.viewPullRequest(selector.cwd, selector.repository, provider.number);
  }

  private async ensureProvider(
    row: PullRequestRow,
    selector: PullRequestSelector,
    request: PublicationRequest,
    knownProvider: GitHubPullRequest | null,
  ): Promise<ProviderResult> {
    const provider = knownProvider ?? (await this.config.cli.findPullRequest(selector));
    if (provider === null) return this.createProvider(row, selector, request);
    if (row.number === null) return { row, provider };
    return { row, provider: await this.updateProvider(provider, selector, request) };
  }

  private persistConnectionState(
    row: PullRequestRow,
    request: PublicationRequest,
    connection: GitHubConnectionContract,
    status: "not_configured" | "failed",
  ): PullRequestView {
    return this.view(
      this.transition(
        row,
        status,
        {
          error_code: connection.error_code,
          error_message: connection.error_message,
          title: request.title,
          body: request.normalizedBody,
        },
        "github",
      ),
    );
  }

  private finalized(pushed: PushedSnapshot, published: ProviderResult) {
    let row = this.reconcileLifecycle(published.row, published.provider.lifecycle);
    const eventType = row.number === null ? "pr.created" : "pr.updated";
    row = this.transition(
      row,
      "created",
      providerPatch(published.provider, pushed),
      "github",
      eventType,
    );
    return this.view(row);
  }

  private async publishOnce(
    run: RunRow,
    request: PreparePullRequestRequest,
  ): Promise<PullRequestView> {
    if (run.status !== "review_ready") {
      throw new GitHubPublicationError(
        "run_not_review_ready",
        "Only a review-ready run can publish a pull request.",
      );
    }
    const publicationRequest = {
      ...request,
      normalizedBody: normalizePullRequestBody(request.body),
    };
    let row = this.recoverInterrupted(
      this.ensureRow(run.id, publicationRequest.title, publicationRequest.normalizedBody),
    );
    if (row.status === "merged" || row.status === "closed") return this.view(row);
    try {
      const worktree = this.requireWorktree(run.id);
      const connection = await this.config.cli.connection();
      if (connection.status === "failed") {
        return this.persistConnectionState(row, publicationRequest, connection, "failed");
      }
      if (connection.status !== "connected") {
        return this.persistConnectionState(row, publicationRequest, connection, "not_configured");
      }
      const remote = await this.config.cli.resolveRemote(worktree.path);
      const context = { run, worktree, remote, request: publicationRequest };
      const existing = await this.refreshExisting(row, context);
      row = existing.row;
      if (existing.completedView) return existing.completedView;
      const pushed = await this.pushSnapshot(row, context);
      row = pushed.row;
      const published = await this.ensureProvider(
        row,
        pushed.selector,
        publicationRequest,
        existing.provider,
      );
      return this.finalized(pushed, published);
    } catch (error) {
      return this.view(this.failure(this.reload(run.id), error));
    }
  }
}

export function createPullRequestPublisher(
  config: PublicationConfig,
): PullRequestPublicationService {
  return new PullRequestPublisher(config);
}
