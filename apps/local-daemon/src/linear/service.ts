import { randomUUID } from "node:crypto";

import {
  findOverlappingIssueSource,
  getIssueSource,
  getProject,
  getSyncState,
  insertIssueSource,
  type IssueSourceRow,
  listIssueSources,
  type NewIssueSource,
} from "@otomat/db";
import {
  issueSourceContractSchema,
  type CreateIssueSourceRequest,
  type IssueSourceContract,
  type IssueSourceSyncResult,
  type LinearConnectionContract,
  type LinearWorkspaceContract,
} from "@otomat/domain";

import { LinearError, linearError } from "./errors.js";
import { SYNC_RESOURCE, SYNC_SOURCE, syncIssueSource } from "./sync.js";
import type { LinearService, LinearServiceConfig, LinearViewer } from "./types.js";

const DISCONNECTED: LinearConnectionContract = {
  status: "disconnected",
  workspace_id: null,
  workspace_name: null,
  user_name: null,
  error_code: null,
  error_message: null,
};

function connected(viewer: LinearViewer): LinearConnectionContract {
  return {
    status: "connected",
    workspace_id: viewer.workspace_id,
    workspace_name: viewer.workspace_name,
    user_name: viewer.user_name,
    error_code: null,
    error_message: null,
  };
}

function failed(error: LinearError): LinearConnectionContract {
  return {
    status: "failed",
    workspace_id: null,
    workspace_name: null,
    user_name: null,
    error_code: error.code,
    error_message: error.message,
  };
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

  constructor(private readonly config: LinearServiceConfig) {
    this.idFactory = config.idFactory ?? randomUUID;
    this.now = config.now ?? (() => new Date());
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

  sources(): IssueSourceContract[] {
    return listIssueSources(this.config.db, SYNC_SOURCE).map((row) => this.toContract(row));
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
    return this.toContract(row);
  }

  async sync(sourceId?: string): Promise<IssueSourceSyncResult[]> {
    const { apiKey, signal } = this.requireAuthorization();
    const sources = this.resolveSources(sourceId);
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

  private toContract(row: Omit<IssueSourceRow, "created_at" | "updated_at">): IssueSourceContract {
    const cursor = getSyncState(this.config.db, SYNC_SOURCE, SYNC_RESOURCE, row.id);
    return issueSourceContractSchema.parse({
      id: row.id,
      project_id: row.project_id,
      source: row.source,
      external_team_id: row.external_team_id,
      external_team_key: row.external_team_key,
      external_team_name: row.external_team_name,
      external_project_id: row.external_project_id,
      external_project_name: row.external_project_name,
      last_synced_at: cursor?.last_synced_at ?? null,
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

  private resolveSources(sourceId: string | undefined): IssueSourceRow[] {
    if (sourceId === undefined) {
      return listIssueSources(this.config.db, SYNC_SOURCE);
    }
    const row = getIssueSource(this.config.db, sourceId);
    if (row === undefined || row.source !== SYNC_SOURCE)
      throw linearError("linear_source_not_found");
    return [row];
  }
}

export function createLinearService(config: LinearServiceConfig): LinearService {
  return new DefaultLinearService(config);
}
