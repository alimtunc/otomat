import { randomUUID } from "node:crypto";

import {
  findOverlappingIssueSource,
  getProject,
  insertIssueSource,
  type Db,
  type NewIssueSource,
} from "@otomat/db";
import {
  type CreateIssueSourceRequest,
  type IssueSourceContract,
  type IssueSourceSyncResult,
  type LinearConnectionContract,
  type LinearWorkspaceContract,
  type SyncLinearRequest,
} from "@otomat/domain";

import type { LinearApiClient } from "./client/types.js";
import { connected, DISCONNECTED, failed } from "./connection-state.js";
import { LinearError, linearError } from "./errors.js";
import {
  deleteSourceMapping,
  listSourceContracts,
  resolveSyncSources,
  sourceContract,
} from "./sources.js";
import { SYNC_SOURCE, syncIssueSource } from "./sync.js";
import { createLinearWriteback } from "./writeback/index.js";
import type { LinearWriteback } from "./writeback/types.js";

export interface LinearServiceConfig {
  db: Db;
  dataDir: string;
  client: LinearApiClient;
  idFactory?: () => string;
  now?: () => Date;
}

export interface LinearService {
  connection(): LinearConnectionContract;
  connect(apiKey: string): Promise<LinearConnectionContract>;
  disconnect(): LinearConnectionContract;
  workspace(): Promise<LinearWorkspaceContract>;
  sources(projectId?: string): IssueSourceContract[];
  createSource(request: CreateIssueSourceRequest): Promise<IssueSourceContract>;
  deleteSource(sourceId: string): void;
  sync(request?: SyncLinearRequest): Promise<IssueSourceSyncResult[]>;
  writeback: LinearWriteback;
}

function supersededRequest(): LinearError {
  return linearError("linear_request_superseded");
}

class DefaultLinearService implements LinearService {
  private apiKey: string | null = null;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private state: LinearConnectionContract = DISCONNECTED;
  private authorization = new AbortController();
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
    if (getProject(this.config.db, request.project_id) === undefined) {
      throw linearError("linear_project_not_found");
    }
    const team = workspace.teams.find((candidate) => candidate.id === request.external_team_id);
    const externalProjectId = request.external_project_id ?? "";
    const externalProject = workspace.projects.find(
      (candidate) =>
        candidate.id === externalProjectId && candidate.team_ids.includes(request.external_team_id),
    );
    if (team === undefined || (externalProjectId !== "" && externalProject === undefined)) {
      throw linearError("linear_source_invalid_selection");
    }
    const existing = findOverlappingIssueSource(
      this.config.db,
      SYNC_SOURCE,
      request.external_team_id,
      externalProjectId,
    );
    if (existing !== undefined) throw linearError("linear_source_already_mapped");

    const row = {
      id: this.idFactory(),
      project_id: request.project_id,
      source: SYNC_SOURCE,
      external_team_id: request.external_team_id,
      external_team_key: team.key,
      external_team_name: team.name,
      external_project_id: externalProjectId,
      external_project_name: externalProject?.name ?? "",
    } satisfies NewIssueSource;
    insertIssueSource(this.config.db, row);
    return sourceContract(this.config.db, row);
  }

  async sync(request: SyncLinearRequest = {}): Promise<IssueSourceSyncResult[]> {
    const { apiKey, signal } = this.requireAuthorization();
    const sources = resolveSyncSources(this.config.db, request);
    const context = {
      db: this.config.db,
      client: this.config.client,
      idFactory: this.idFactory,
      now: this.now,
      signal,
    };

    return this.authorized(signal, async () => {
      const syncResults: IssueSourceSyncResult[] = [];
      for (const source of sources) {
        syncResults.push(await syncIssueSource(context, source, apiKey));
      }
      return syncResults;
    });
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
