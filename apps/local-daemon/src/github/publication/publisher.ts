import { getPullRequestForRun, getRepository, type PullRequestRow, type RunRow } from "@otomat/db";
import type { GitHubConnectionContract, PreparePullRequestRequest } from "@otomat/domain";

import type { GitWorktreeService, WorktreeRecord } from "#git";

import { normalizePullRequestBody } from "../body.js";
import { GitHubPublicationError } from "../errors.js";
import type { PullRequestSelector, PullRequestView } from "../types.js";
import { ensureProvider, providerPatch, refreshExistingPullRequest } from "./provider.js";
import { PublicationStore } from "./store.js";
import type {
  ProviderResult,
  PublicationConfig,
  PublicationContext,
  PublicationRequest,
  PullRequestPublicationService,
} from "./types.js";

interface PushedSnapshot {
  row: PullRequestRow;
  headSha: string;
  diffSha: string;
  selector: PullRequestSelector;
}

class PullRequestPublisher implements PullRequestPublicationService {
  private readonly publications = new Map<string, Promise<PullRequestView>>();
  private readonly store: PublicationStore;

  constructor(private readonly config: PublicationConfig) {
    this.store = new PublicationStore(config);
  }

  get(runId: string): PullRequestView | null {
    let row = getPullRequestForRun(this.config.db, runId);
    if (row && !this.publications.has(runId)) row = this.store.recoverInterrupted(row);
    return row ? this.store.view(row) : null;
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

  private requireWorktree(runId: string): {
    worktrees: GitWorktreeService;
    worktree: WorktreeRecord;
  } {
    const worktrees = this.config.repositories.forRun(runId)?.service;
    const worktree = worktrees?.get(runId);
    if (!worktrees || !worktree) {
      throw new GitHubPublicationError("worktree_missing", "The run has no active worktree.");
    }
    const diff = worktrees.diff(runId);
    if (diff.files.length === 0) {
      throw new GitHubPublicationError("diff_empty", "The run has no changes to publish.");
    }
    return { worktrees, worktree };
  }

  private async pushSnapshot(
    row: PullRequestRow,
    context: PublicationContext,
  ): Promise<PushedSnapshot> {
    // An existing PR's head is its identity; only a first publish may pick a nicer remote name.
    const head =
      row.number !== null
        ? (row.head_ref ?? context.worktree.branch)
        : (context.request.head_ref ?? row.head_ref ?? context.worktree.branch);
    row = this.store.transition(
      row,
      "pushing",
      {
        title: context.request.title,
        body: context.request.normalizedBody,
        // Persisted before the push so a retry after a failed create targets the same branch.
        head_ref: head,
        error_code: null,
        error_message: null,
      },
      "git",
    );
    const snapshot = context.worktrees.snapshot(context.run.id);
    // Re-read after snapshot(): the commit moves the tree, and this diff is the published anchor.
    const diff = context.worktrees.diff(context.run.id);
    await this.config.cli.push(context.worktree.path, context.remote.name, head);
    return {
      row,
      headSha: snapshot.headSha,
      diffSha: diff.sha,
      selector: {
        cwd: context.worktree.path,
        repository: context.remote.repository,
        head,
        base: this.requireBaseBranch(context.worktree),
      },
    };
  }

  /** The branch the run forked from is the only base its reviewed diff matches. */
  private requireBaseBranch(worktree: WorktreeRecord): string {
    if (worktree.baseRef) return worktree.baseRef;
    // Worktrees recorded before fork refs were tracked carry no base ref.
    const repository = getRepository(this.config.db, worktree.repositoryId);
    if (!repository) {
      throw new GitHubPublicationError(
        "repository_missing",
        "The run's worktree points at a repository that no longer exists.",
      );
    }
    return repository.default_branch;
  }

  private persistConnectionState(
    row: PullRequestRow,
    request: PublicationRequest,
    connection: GitHubConnectionContract,
    status: "not_configured" | "failed",
  ): PullRequestView {
    return this.store.view(
      this.store.transition(
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

  private finalized(pushed: PushedSnapshot, published: ProviderResult): PullRequestView {
    let row = this.store.reconcileLifecycle(published.row, published.provider.lifecycle);
    const eventType = row.number === null ? "pr.created" : "pr.updated";
    row = this.store.transition(
      row,
      "created",
      providerPatch(published.provider, pushed),
      "github",
      eventType,
    );
    return this.store.view(row);
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
    let row = this.store.recoverInterrupted(
      this.store.ensureRow(run.id, publicationRequest.title, publicationRequest.normalizedBody),
    );
    if (row.status === "merged" || row.status === "closed") return this.store.view(row);
    try {
      const { worktrees, worktree } = this.requireWorktree(run.id);
      const connection = await this.config.cli.connection();
      if (connection.status === "failed") {
        return this.persistConnectionState(row, publicationRequest, connection, "failed");
      }
      if (connection.status !== "connected") {
        return this.persistConnectionState(row, publicationRequest, connection, "not_configured");
      }
      const remote = await this.config.cli.resolveRemote(worktree.path);
      const context = { run, worktrees, worktree, remote, request: publicationRequest };
      const existing = await refreshExistingPullRequest(this.store, this.config.cli, row, context);
      row = existing.row;
      if (existing.completedView) return existing.completedView;
      const pushed = await this.pushSnapshot(row, context);
      row = pushed.row;
      const published = await ensureProvider(
        this.store,
        this.config.cli,
        row,
        pushed.selector,
        publicationRequest,
        existing.provider,
      );
      return this.finalized(pushed, published);
    } catch (error) {
      return this.store.view(this.store.failure(this.store.reload(run.id), error));
    }
  }
}

export function createPullRequestPublisher(
  config: PublicationConfig,
): PullRequestPublicationService {
  return new PullRequestPublisher(config);
}
