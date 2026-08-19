import { getPullRequestForRun, type PullRequestRow, type RunRow } from "@otomat/db";
import type {
  GitHubConnectionContract,
  PreparePullRequestRequest,
  PullRequestProposal,
  PullRequestPublishability,
  PullRequestSync,
  PushPullRequestRequest,
} from "@otomat/domain";

import { GitHubPublicationError } from "../errors.js";
import type { GenerationAgent } from "../generation/agent.js";
import { buildGenerationInput } from "../generation/input.js";
import type { PullRequestGenerator, PullRequestView } from "../types.js";
import { createPublication } from "./create.js";
import {
  composeSubject,
  issueIdentifier,
  requestedDetails,
  resolvePublicationRequest,
} from "./details.js";
import { providerPatch, refreshExistingPullRequest, updateDetails } from "./provider.js";
import { computePublishability } from "./publishability.js";
import { pushCommits } from "./push.js";
import { publicationRunId, PublicationStore } from "./store.js";
import { computeSync, UNAVAILABLE_SYNC } from "./sync.js";
import type {
  PublicationConfig,
  PublicationRequest,
  PullRequestPublicationService,
} from "./types.js";
import { resolveWorkspace } from "./workspace.js";

class PullRequestPublisher implements PullRequestPublicationService {
  private readonly operations = new Map<string, Promise<unknown>>();
  private readonly store: PublicationStore;

  constructor(
    private readonly config: PublicationConfig,
    private readonly generator: PullRequestGenerator | undefined,
  ) {
    this.store = new PublicationStore(config);
  }

  /** A read with write side effects: noticing a merge here settles the run's worktree and issue. */
  async get(runId: string): Promise<PullRequestView | null> {
    const stored = getPullRequestForRun(this.config.db, runId);
    if (!stored) return null;
    if (this.operations.has(runId)) return this.view(stored);
    return this.view(await this.refreshLifecycle(this.store.recoverInterrupted(stored)));
  }

  publishability(runId: string): Promise<PullRequestPublishability> {
    return computePublishability(this.config, runId);
  }

  publish(run: RunRow, request: PreparePullRequestRequest): Promise<PullRequestView> {
    return this.serialize(run.id, () => this.publishOnce(run, request));
  }

  /** Serialized with the publications: a proposal written between a push and its create would describe another tree. */
  generate(run: RunRow, agent: GenerationAgent): Promise<PullRequestProposal> {
    const generator = this.generator;
    if (generator === undefined) {
      throw new GitHubPublicationError(
        "pr_generation_unavailable",
        "This daemon runs no metadata generator; write the title and description by hand.",
      );
    }
    return this.serialize(run.id, async () => {
      // Preflighted here: a workspace that cannot publish must refuse before the generator is paid for.
      await resolveWorkspace(this.config, run.id);
      const proposal = await generator.generate(agent, buildGenerationInput(this.config, run));
      const identifier = issueIdentifier(this.config.db, run.issue_id);
      this.store.recordProposal(run, proposal, composeSubject(proposal.subject, identifier));
      return proposal;
    });
  }

  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView> {
    return this.serialize(runId, async () => {
      const stored = getPullRequestForRun(this.config.db, runId);
      return this.view(await pushCommits(this.config, this.store, stored, request));
    });
  }

  /** Queued, never dropped: two writers on one branch is how a lease turns into a lost commit. */
  private serialize<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const active = this.operations.get(runId);
    const started: Promise<T> = (active ? active.then(operation, operation) : operation()).finally(
      () => {
        if (this.operations.get(runId) === started) this.operations.delete(runId);
      },
    );
    this.operations.set(runId, started);
    return started;
  }

  /** The run's own worktree, falling back to the repository root: a merge is exactly what takes the worktree away. */
  private async refreshLifecycle(row: PullRequestRow): Promise<PullRequestRow> {
    if (row.number === null || (row.status !== "open" && row.status !== "draft")) return row;
    const runId = publicationRunId(row);
    const binding = this.config.repositories.forRun(runId);
    if (binding === null) return row;
    const cwd = binding.service.get(runId)?.path ?? binding.rootPath;
    try {
      const { repository } = await this.config.cli.resolveRemote(cwd);
      const provider = await this.config.cli.viewPullRequest(cwd, repository, row.number);
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
      const workspace = await resolveWorkspace(this.config, publicationRunId(row));
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
        ...requestedDetails(request),
        error_code: connection.error_code,
        error_message: connection.error_message,
      },
      "github",
    );
  }

  private async publishOnce(
    run: RunRow,
    request: PreparePullRequestRequest,
  ): Promise<PullRequestView> {
    const publicationRequest = resolvePublicationRequest(this.config.db, run, request);
    let row = this.store.recoverInterrupted(
      this.store.ensureRow(run, publicationRequest.title, publicationRequest.normalizedBody),
    );
    if (row.status === "merged" || row.status === "closed") return this.view(row);
    // Publishability is a property of the workspace, so how the run ended is recorded, never enforced.
    if (row.number === null && run.status !== "review_ready") {
      this.store.recordExecutionOverride(row, run);
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
      return this.view(
        this.store.patch(
          reconciled,
          { ...requestedDetails(publicationRequest), ...providerPatch(provider) },
          "github",
        ),
      );
    } catch (error) {
      return this.view(this.store.failure(this.store.reload(run.id), error));
    }
  }
}

export function createPullRequestPublisher(
  config: PublicationConfig,
  generator: PullRequestGenerator | undefined,
): PullRequestPublicationService {
  return new PullRequestPublisher(config, generator);
}
