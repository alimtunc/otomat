import { randomUUID } from "node:crypto";

import {
  type CreateIssueSourceRequest,
  type IssueSourceContract,
  type IssueSourceSyncResult,
  type LinearConnectionContract,
  type LinearLifecycleSignal,
  type LinearSyncStatusContract,
  type LinearWorkspaceContract,
  type SyncLinearRequest,
  type UpdateIssueSourceRequest,
} from "@otomat/domain";

import { connected, DISCONNECTED, failed } from "./connection-state.js";
import { LinearError, linearError } from "./errors.js";
import { resolveLifecycleTarget } from "./lifecycle.js";
import type { LinearService, LinearServiceConfig } from "./service-contract.js";
import {
  createSourceMapping,
  deleteSourceMapping,
  listSourceContracts,
  projectSyncStatus,
  resolveSyncSources,
  updateSourceLifecycle,
} from "./sources.js";
import { LinearSyncRuns, syncScope } from "./sync-runs.js";
import { syncIssueSource } from "./sync.js";
import { createLinearWriteback } from "./writeback/index.js";
import type { LinearWriteback } from "./writeback/types.js";

function supersededRequest(): LinearError {
  return linearError("linear_request_superseded");
}

class DefaultLinearService implements LinearService {
  private apiKey: string | null = null;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private state: LinearConnectionContract = DISCONNECTED;
  private authorization = new AbortController();
  private readonly runs = new LinearSyncRuns();
  /** Per-issue tails so overlapping lifecycle round-trips land in signal order. */
  private readonly lifecycleChains = new Map<string, Promise<void>>();
  readonly writeback: LinearWriteback;

  constructor(private readonly config: LinearServiceConfig) {
    this.idFactory = config.idFactory ?? randomUUID;
    this.now = config.now ?? (() => new Date());
    this.writeback = createLinearWriteback({
      db: config.db,
      dataDir: config.dataDir,
      client: config.client,
      idFactory: this.idFactory,
      now: this.now,
      authorize: () => this.requireAuthorization(),
      guard: (signal, call) => this.authorized(signal, call),
    });
  }

  connection(): LinearConnectionContract {
    return this.state;
  }

  async connect(apiKey: string): Promise<LinearConnectionContract> {
    const signal = this.beginCredentialChange();
    try {
      const viewer = await this.config.client.viewer(apiKey, signal);
      if (!this.isCurrent(signal)) throw supersededRequest();
      this.apiKey = apiKey;
      this.state = connected(viewer);
    } catch (error) {
      if (!this.isCurrent(signal)) throw supersededRequest();
      if (!(error instanceof LinearError)) throw error;
      this.state = failed(error);
    }
    return this.state;
  }

  disconnect(): LinearConnectionContract {
    this.beginCredentialChange();
    return this.state;
  }

  async workspace(): Promise<LinearWorkspaceContract> {
    const { apiKey, signal } = this.requireAuthorization();
    return this.authorized(signal, () => this.config.client.workspace(apiKey, signal));
  }

  sources(projectId?: string): IssueSourceContract[] {
    return listSourceContracts(this.config.db, projectId);
  }

  deleteSource(sourceId: string): void {
    deleteSourceMapping(this.config.db, sourceId);
  }

  async createSource(request: CreateIssueSourceRequest): Promise<IssueSourceContract> {
    const { apiKey, signal } = this.requireAuthorization();
    const workspace = await this.authorized(signal, () =>
      this.config.client.workspace(apiKey, signal),
    );
    if (!this.isCurrent(signal)) throw supersededRequest();
    return createSourceMapping(this.config.db, workspace, this.idFactory(), request);
  }

  async updateSource(
    sourceId: string,
    request: UpdateIssueSourceRequest,
  ): Promise<IssueSourceContract> {
    const { apiKey, signal } = this.requireAuthorization();
    const workspace = await this.authorized(signal, () =>
      this.config.client.workspace(apiKey, signal),
    );
    return updateSourceLifecycle(this.config.db, workspace, sourceId, request);
  }

  /** Skipping leaves no trace: a recorded failure would claim a write Otomat never could attempt. */
  async syncIssueLifecycle(signal: LinearLifecycleSignal): Promise<void> {
    if (this.state.status !== "connected") return;
    const target = resolveLifecycleTarget(this.config.db, signal.issue_id, signal.phase);
    if (target === null) return;
    // Chained per issue so a slow earlier assertion can never land after (and undo) a later
    // one; in memory on purpose — the daemon is the single writer, a restart serializes.
    const tail = this.lifecycleChains.get(signal.issue_id) ?? Promise.resolve();
    const link = tail.then(async () => {
      await this.writeback.publishLifecycle(signal.issue_id, {
        phase: signal.phase,
        target,
        run_id: signal.run_id,
      });
    });
    // The stored tail never rejects: a failed assertion is the ledger's to report, not a dam.
    const settled: Promise<void> = link
      .catch(() => undefined)
      .then(() => {
        if (this.lifecycleChains.get(signal.issue_id) === settled) {
          this.lifecycleChains.delete(signal.issue_id);
        }
      });
    this.lifecycleChains.set(signal.issue_id, settled);
    return link;
  }

  async sync(request: SyncLinearRequest = {}): Promise<IssueSourceSyncResult[]> {
    const { apiKey, signal } = this.requireAuthorization();
    const sources = resolveSyncSources(this.config.db, request);
    const full = request.full === true;
    const context = {
      db: this.config.db,
      client: this.config.client,
      idFactory: this.idFactory,
      now: this.now,
      signal,
      full,
    };

    const results: IssueSourceSyncResult[] = [];
    try {
      await this.authorized(signal, async () => {
        for (const source of sources) {
          results.push(
            await this.runs.pass(source.id, full, () => syncIssueSource(context, source, apiKey)),
          );
        }
      });
    } catch (error) {
      this.runs.failed(syncScope(request, sources, results), error);
      throw error;
    }
    this.runs.succeeded(syncScope(request, sources, results));
    return results;
  }

  syncStatus(projectId: string): LinearSyncStatusContract {
    return projectSyncStatus(this.config.db, this.runs, projectId);
  }

  private requireAuthorization(): {
    apiKey: string;
    signal: AbortSignal;
  } {
    const apiKey = this.apiKey;
    if (apiKey === null) throw linearError("linear_not_connected");
    return {
      apiKey,
      signal: this.authorization.signal,
    };
  }

  private async authorized<T>(signal: AbortSignal, call: () => Promise<T>): Promise<T> {
    try {
      const response = await call();
      if (!this.isCurrent(signal)) throw supersededRequest();
      return response;
    } catch (error) {
      if (!this.isCurrent(signal)) throw supersededRequest();
      if (error instanceof LinearError && error.code === "linear_unauthorized") {
        this.beginCredentialChange();
        this.state = failed(error);
      }
      throw error;
    }
  }

  private beginCredentialChange(): AbortSignal {
    this.authorization.abort();
    this.authorization = new AbortController();
    this.apiKey = null;
    this.state = DISCONNECTED;
    return this.authorization.signal;
  }

  private isCurrent(signal: AbortSignal): boolean {
    return signal === this.authorization.signal && !signal.aborted;
  }
}

export function createLinearService(config: LinearServiceConfig): LinearService {
  return new DefaultLinearService(config);
}
