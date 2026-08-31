import { randomUUID } from "node:crypto";

import {
  deleteLinearConnection,
  getIssue,
  getLinearConnection,
  listLinearConnections,
  saveLinearConnection,
} from "@otomat/db";
import {
  type ConnectLinearRequest,
  type CreateIssueSourceRequest,
  type IssueSourceContract,
  type IssueSourceSyncResult,
  type LinearConnectionContract,
  type LinearLifecycleReconcileResult,
  type LinearLifecycleSignal,
  type LinearSyncStatusContract,
  type LinearWorkspaceContract,
  type SyncLinearRequest,
  type UpdateIssueSourceRequest,
} from "@otomat/domain";

import {
  type LinearAuthorization,
  LinearConnectionRegistry,
  requireConnectionRow,
} from "./connections.js";
import { LinearError, linearError } from "./errors.js";
import { resolveLifecycleTarget } from "./lifecycle.js";
import { reconcileSourceLifecycle } from "./reconcile.js";
import type { LinearService, LinearServiceConfig } from "./service-contract.js";
import {
  connectionSources,
  createSourceMapping,
  deleteSourceMapping,
  listSourceContracts,
  projectConnectionId,
  projectSyncStatus,
  requireSourceRow,
  resolveSyncSources,
  updateSourceLifecycle,
} from "./sources.js";
import { LinearSyncRuns, syncScope } from "./sync-runs.js";
import { syncIssueSource } from "./sync.js";
import { createLinearWriteback } from "./writeback/index.js";
import type { LinearWriteback } from "./writeback/types.js";

class DefaultLinearService implements LinearService {
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly registry = new LinearConnectionRegistry();
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
      authorize: (issueId) => this.authorizeIssue(issueId),
    });
  }

  connections(): LinearConnectionContract[] {
    return listLinearConnections(this.config.db).map((row) => this.registry.contract(row));
  }

  async connect(request: ConnectLinearRequest): Promise<LinearConnectionContract> {
    const signal = this.registry.begin(request.id);
    try {
      const viewer = await this.config.client.viewer(request.api_key, signal);
      if (!this.registry.isCurrent(request.id, signal)) {
        throw linearError("linear_request_superseded");
      }
      this.registry.hold(request.id, request.api_key);
      saveLinearConnection(this.config.db, { id: request.id, label: request.label, ...viewer });
    } catch (error) {
      if (!this.registry.isCurrent(request.id, signal)) {
        throw linearError("linear_request_superseded");
      }
      // Only a catalogued connection can carry a failed state; a first attempt just refuses.
      if (
        error instanceof LinearError &&
        getLinearConnection(this.config.db, request.id) !== undefined
      ) {
        this.registry.fail(request.id, error);
      }
      throw error;
    }
    return this.registry.contract(requireConnectionRow(this.config.db, request.id));
  }

  disconnect(connectionId: string): void {
    requireConnectionRow(this.config.db, connectionId);
    for (const source of connectionSources(this.config.db, connectionId)) {
      deleteSourceMapping(this.config.db, source.id);
    }
    deleteLinearConnection(this.config.db, connectionId);
    this.registry.forget(connectionId);
  }

  async workspace(connectionId: string): Promise<LinearWorkspaceContract> {
    const authorization = this.authorizeConnection(connectionId);
    const workspace = await authorization.run(() =>
      this.config.client.workspace(authorization.apiKey, authorization.signal),
    );
    // Re-checked after the call settles: what a caller writes from this answer must not
    // outlive the key it was read with.
    if (!this.registry.isCurrent(connectionId, authorization.signal)) {
      throw linearError("linear_request_superseded");
    }
    return workspace;
  }

  sources(projectId?: string): IssueSourceContract[] {
    return listSourceContracts(this.config.db, projectId);
  }

  deleteSource(sourceId: string): void {
    deleteSourceMapping(this.config.db, sourceId);
  }

  async createSource(request: CreateIssueSourceRequest): Promise<IssueSourceContract> {
    const workspace = await this.workspace(request.connection_id);
    return createSourceMapping(this.config.db, workspace, this.idFactory(), request);
  }

  async updateSource(
    sourceId: string,
    request: UpdateIssueSourceRequest,
  ): Promise<IssueSourceContract> {
    const row = requireSourceRow(this.config.db, sourceId);
    const workspace = await this.workspace(row.connection_id);
    return updateSourceLifecycle(this.config.db, workspace, sourceId, request);
  }

  async reconcileSource(sourceId: string): Promise<LinearLifecycleReconcileResult> {
    const source = requireSourceRow(this.config.db, sourceId);
    this.authorizeConnection(source.connection_id);
    return reconcileSourceLifecycle(this.config.db, source, (signal) =>
      this.syncIssueLifecycle(signal),
    );
  }

  /** Skipping leaves no trace: a recorded failure would claim a write Otomat never could attempt. */
  async syncIssueLifecycle(signal: LinearLifecycleSignal): Promise<void> {
    const connectionId = this.issueConnectionId(signal.issue_id);
    if (connectionId === null || !this.registry.holdsKey(connectionId)) return;
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
    const sources = resolveSyncSources(this.config.db, request);
    const full = request.full === true;
    const results: IssueSourceSyncResult[] = [];
    try {
      for (const source of sources) {
        const authorization = this.authorizeConnection(source.connection_id);
        const context = {
          db: this.config.db,
          client: this.config.client,
          idFactory: this.idFactory,
          now: this.now,
          signal: authorization.signal,
          full,
        };
        results.push(
          await this.runs.pass(source.id, full, () =>
            authorization.run(() => syncIssueSource(context, source, authorization.apiKey)),
          ),
        );
      }
    } catch (error) {
      this.runs.failed(syncScope(request, sources, results), error);
      throw error;
    }
    this.runs.succeeded(syncScope(request, sources, results));
    return results;
  }

  syncStatus(projectId: string): LinearSyncStatusContract {
    const connectionId = projectConnectionId(this.config.db, projectId);
    const row =
      connectionId === null ? undefined : getLinearConnection(this.config.db, connectionId);
    return projectSyncStatus(
      this.config.db,
      this.runs,
      projectId,
      row === undefined ? null : this.registry.contract(row),
    );
  }

  private authorizeConnection(connectionId: string): LinearAuthorization {
    requireConnectionRow(this.config.db, connectionId);
    return this.registry.authorize(connectionId);
  }

  private issueConnectionId(issueId: string): string | null {
    const issue = getIssue(this.config.db, issueId);
    return issue === undefined ? null : projectConnectionId(this.config.db, issue.project_id);
  }

  private authorizeIssue(issueId: string): LinearAuthorization {
    const connectionId = this.issueConnectionId(issueId);
    if (connectionId === null) throw linearError("linear_not_connected");
    return this.registry.authorize(connectionId);
  }
}

export function createLinearService(config: LinearServiceConfig): LinearService {
  return new DefaultLinearService(config);
}
