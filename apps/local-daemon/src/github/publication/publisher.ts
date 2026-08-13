import { getPullRequestForRun, type PullRequestRow, type RunRow } from "@otomat/db";
import type {
  GitHubConnectionContract,
  PreparePullRequestRequest,
  PullRequestSync,
  PushPullRequestRequest,
} from "@otomat/domain";

import { normalizePullRequestBody } from "../body.js";
import { GitHubPublicationError } from "../errors.js";
import type { PullRequestView } from "../types.js";
import { createPublication } from "./create.js";
import { providerPatch, refreshExistingPullRequest, updateDetails } from "./provider.js";
import { pushCommits } from "./push.js";
import { PublicationStore } from "./store.js";
import { computeSync, UNAVAILABLE_SYNC } from "./sync.js";
import type {
  PublicationConfig,
  PublicationRequest,
  PullRequestPublicationService,
} from "./types.js";
import { resolveWorkspace } from "./workspace.js";

class PullRequestPublisher implements PullRequestPublicationService {
  private readonly operations = new Map<string, Promise<PullRequestView>>();
  private readonly store: PublicationStore;

  constructor(private readonly config: PublicationConfig) {
    this.store = new PublicationStore(config);
  }

  /** A read with write side effects: noticing a merge here settles the run's worktree and issue. */
  async get(runId: string): Promise<PullRequestView | null> {
    const stored = getPullRequestForRun(this.config.db, runId);
    if (!stored) return null;
    if (this.operations.has(runId)) return this.view(stored);
    return this.view(await this.refreshLifecycle(this.store.recoverInterrupted(stored)));
  }

  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView> {
    return this.serialize(run.id, () => this.publishOnce(run, request));
  }

  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView> {
    return this.serialize(runId, async () => {
      const stored = getPullRequestForRun(this.config.db, runId);
      return this.view(await pushCommits(this.config, this.store, stored, request));
    });
  }

  /** Queued, never dropped: two writers on one branch is how a lease turns into a lost commit. */
  private serialize(
    runId: string,
    operation: () => Promise<PullRequestView>,
  ): Promise<PullRequestView> {
    const active = this.operations.get(runId);
    const started: Promise<PullRequestView> = (
      active ? active.then(operation, operation) : operation()
    ).finally(() => {
      if (this.operations.get(runId) === started) this.operations.delete(runId);
    });
    this.operations.set(runId, started);
    return started;
  }

  /** The repository root is the cwd, not the worktree: a merge is exactly what takes that away. */
  private async refreshLifecycle(row: PullRequestRow): Promise<PullRequestRow> {
    if (row.number === null || (row.status !== "open" && row.status !== "draft")) return row;
    const rootPath = this.config.repositories.forRun(row.run_id)?.rootPath;
    if (rootPath === undefined) return row;
    try {
      const { repository } = await this.config.cli.resolveRemote(rootPath);
      const provider = await this.config.cli.viewPullRequest(rootPath, repository, row.number);
      return this.store.reconcileLifecycle(row, provider.lifecycle);
    } catch (error) {
      console.error(`[otomat] pull request refresh for run ${row.run_id} failed`, error);
      return row;
    }
  }

  private async view(row: PullRequestRow): Promise<PullRequestView> {
    return { row, sync: await this.sync(row) };
  }

  /** A comparison that could not be made is still a comparison: only an absent branch answers null. */
  private async sync(row: PullRequestRow): Promise<PullRequestSync | null> {
    if (row.number === null || row.head_ref === null) return null;
    if (row.status === "merged" || row.status === "closed") return null;
    try {
      const workspace = await resolveWorkspace(this.config, row.run_id);
      return await computeSync({
        cli: this.config.cli,
        worktreePath: workspace.worktree.path,
        remote: workspace.remote.name,
        headRef: row.head_ref,
        baseRef: workspace.baseRef,
      });
    } catch (error) {
      console.error(`[otomat] workspace for run ${row.run_id} could not be compared`, error);
      return UNAVAILABLE_SYNC;
    }
  }

  private persistConnectionState(
    row: PullRequestRow,
    request: PublicationRequest,
    connection: GitHubConnectionContract,
    status: "not_configured" | "failed",
  ): PullRequestRow {
    return this.store.transition(
      row,
      status,
      {
        error_code: connection.error_code,
        error_message: connection.error_message,
        title: request.title,
        body: request.normalizedBody,
      },
      "github",
    );
  }

  private async publishOnce(
    run: RunRow,
    request: PreparePullRequestRequest,
  ): Promise<PullRequestView> {
    const publicationRequest = {
      ...request,
      normalizedBody: normalizePullRequestBody(request.body),
    };
    let row = this.store.recoverInterrupted(
      this.store.ensureRow(run.id, publicationRequest.title, publicationRequest.normalizedBody),
    );
    if (row.status === "merged" || row.status === "closed") return this.view(row);
    // Only opening a pull request waits on the run: an existing one outlives the launch state that made it.
    if (row.number === null && run.status !== "review_ready") {
      throw new GitHubPublicationError(
        "run_not_review_ready",
        "Only a review-ready run can open a pull request.",
      );
    }
    try {
      const workspace = await resolveWorkspace(this.config, run.id);
      const connection = await this.config.cli.connection();
      if (connection.status !== "connected") {
        const status = connection.status === "failed" ? "failed" : "not_configured";
        return this.view(this.persistConnectionState(row, publicationRequest, connection, status));
      }
      const context = { run, workspace, request: publicationRequest };
      const existing = await refreshExistingPullRequest(this.store, this.config.cli, row, context);
      row = existing.row;
      if (existing.done) return this.view(row);
      if (existing.provider === null) {
        return this.view(await createPublication(this.config, this.store, row, context));
      }
      const provider = await updateDetails(
        this.config.cli,
        existing.provider,
        { cwd: workspace.worktree.path, repository: workspace.remote.repository },
        publicationRequest,
      );
      const reconciled = this.store.reconcileLifecycle(row, provider.lifecycle);
      return this.view(this.store.patch(reconciled, providerPatch(provider), "github"));
    } catch (error) {
      return this.view(this.store.failure(this.store.reload(run.id), error));
    }
  }
}

export function createPullRequestPublisher(
  config: PublicationConfig,
): PullRequestPublicationService {
  return new PullRequestPublisher(config);
}
