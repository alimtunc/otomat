import {
  getPullRequestForRun,
  listActivePublications,
  type PullRequestRow,
  type RunRow,
} from "@otomat/db";
import type {
  PublishPullRequestRequest,
  PullRequestProposal,
  PullRequestPublicationDetails,
  PullRequestPublicationState,
  PullRequestPublishability,
  PushPullRequestRequest,
} from "@otomat/domain";

import { GitHubPublicationError } from "../errors.js";
import { resolveGenerationAgent, type GenerationAgent } from "../generation/agent.js";
import { buildGenerationInput } from "../generation/input.js";
import type { PullRequestGenerator, PullRequestView } from "../types.js";
import { composeSubject, issueIdentifier, resolvePublicationRequest } from "./details.js";
import { publishOnce } from "./publish-once.js";
import { computePublishability } from "./publishability.js";
import { pushCommits } from "./push.js";
import { publicationRunId, PublicationStore } from "./store.js";
import type { PublicationConfig, PullRequestPublicationService } from "./types.js";
import { publicationView } from "./view.js";
import { resolveWorkspace } from "./workspace.js";

/** The phase the accepted command starts in, so the answer already names where the daemon is. */
function initialPhase(
  row: PullRequestRow,
  request: PublishPullRequestRequest,
): PullRequestPublicationState {
  if (request.details === undefined) return "generating";
  return row.number === null ? "committing" : "creating";
}

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
    if (this.operations.has(runId)) return publicationView(this.config, stored);
    return publicationView(
      this.config,
      await this.refreshLifecycle(this.store.recoverInterrupted(stored)),
    );
  }

  publishability(runId: string): Promise<PullRequestPublishability> {
    return computePublishability(this.config, runId);
  }

  /** The row, the phase and the agent resolve here so an impossible command is refused to the caller, not in the background. */
  async publish(run: RunRow, request: PublishPullRequestRequest): Promise<PullRequestView> {
    const agent = request.details === undefined ? this.requireGenerationAgent(run) : null;
    const title = request.details === undefined ? "" : this.composedTitle(run, request.details);
    const row = this.store.ensureRow(run, title, request.details?.body ?? null);
    // A settled pull request takes no publication; entering a phase would open an operation nothing can close.
    if (row.status === "merged" || row.status === "closed") {
      return publicationView(this.config, row);
    }
    // A command queued behind another leaves the phase alone: the row shows the publication actually running.
    const accepted = this.operations.has(run.id)
      ? row
      : this.enterPhase(run.id, initialPhase(row, request));
    void this.serialize(run.id, () => this.runPublication(run, request, agent)).catch(
      (error: unknown) => {
        console.error(`[otomat] publication for run ${run.id} could not be recorded`, error);
      },
    );
    return publicationView(this.config, accepted);
  }

  /** Serialized with the publications: a proposal written between a push and its create would describe another tree. */
  generate(run: RunRow, agent: GenerationAgent): Promise<PullRequestProposal> {
    const generator = this.requireGenerator();
    return this.serialize(run.id, () => this.writeProposal(run, agent, generator));
  }

  pushCommits(runId: string, request: PushPullRequestRequest): Promise<PullRequestView> {
    return this.serialize(runId, async () => {
      const stored = getPullRequestForRun(this.config.db, runId);
      return publicationView(
        this.config,
        await pushCommits(this.config, this.store, stored, request),
      );
    });
  }

  /** At boot nothing is in flight, so every row resting on a phase is a publication a stopped process left behind. */
  reconcileInterrupted(): number {
    const interrupted = listActivePublications(this.config.db).filter(
      (row) => !this.operations.has(publicationRunId(row)),
    );
    for (const row of interrupted) this.store.recoverInterrupted(row);
    return interrupted.length;
  }

  async settle(): Promise<void> {
    while (this.operations.size > 0) await Promise.allSettled(this.operations.values());
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

  private requireGenerator(): PullRequestGenerator {
    if (this.generator === undefined) {
      throw new GitHubPublicationError(
        "pr_generation_unavailable",
        "This daemon runs no metadata generator; write the title and description by hand.",
      );
    }
    return this.generator;
  }

  private requireGenerationAgent(run: RunRow): GenerationAgent {
    this.requireGenerator();
    return resolveGenerationAgent(this.config.db, run);
  }

  /** Idempotent: an accepted command already carries its phase, a queued one takes it when it starts. */
  private enterPhase(runId: string, phase: PullRequestPublicationState): PullRequestRow {
    const row = this.store.reload(runId);
    if (row.publication_status === phase) return row;
    return this.store.transition(row, phase, {}, "otomat");
  }

  private composedTitle(run: RunRow, details: PullRequestPublicationDetails): string {
    return composeSubject(details.subject, issueIdentifier(this.config.db, run.issue_id)).title;
  }

  private async writeProposal(
    run: RunRow,
    agent: GenerationAgent,
    generator: PullRequestGenerator,
  ): Promise<PullRequestProposal> {
    // Preflighted here: a workspace that cannot publish must refuse before the generator is paid for.
    await resolveWorkspace(this.config, run.id);
    const proposal = await generator.generate(agent, buildGenerationInput(this.config, run));
    const identifier = issueIdentifier(this.config.db, run.issue_id);
    this.store.recordProposal(run, proposal, composeSubject(proposal.subject, identifier));
    return proposal;
  }

  /** The whole operation, off the request: a failure in any phase is persisted, never thrown at nobody. */
  private async runPublication(
    run: RunRow,
    request: PublishPullRequestRequest,
    agent: GenerationAgent | null,
  ): Promise<void> {
    try {
      const details = request.details ?? (await this.composeDetails(run, agent));
      await publishOnce(
        this.config,
        this.store,
        run,
        resolvePublicationRequest(this.config.db, run, details, request.mode),
      );
    } catch (error) {
      this.store.failure(this.store.reload(run.id), error);
    }
  }

  private async composeDetails(
    run: RunRow,
    agent: GenerationAgent | null,
  ): Promise<PullRequestPublicationDetails> {
    if (agent === null) throw new Error(`publication for run ${run.id} lost its generation agent`);
    this.enterPhase(run.id, "generating");
    const proposal = await this.writeProposal(run, agent, this.requireGenerator());
    return { subject: proposal.subject, body: proposal.body, head_ref: proposal.branch };
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
}

export function createPullRequestPublisher(
  config: PublicationConfig,
  generator: PullRequestGenerator | undefined,
): PullRequestPublicationService {
  return new PullRequestPublisher(config, generator);
}
