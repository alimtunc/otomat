import { randomUUID } from "node:crypto";

import {
  findIssueSourceByExternalScope,
  getIssueSource,
  getProject,
  getSyncState,
  insertIssueSource,
  type IssueSourceRow,
  listIssueSources,
} from "@otomat/db";
import type {
  CreateIssueSourceRequest,
  IssueSourceContract,
  IssueSourceSyncResult,
  LinearConnectionContract,
} from "@otomat/domain";

import { createLinearCredentialStore } from "./credential.js";
import { LinearError, linearError, safeLinearFailure } from "./errors.js";
import { SYNC_RESOURCE, SYNC_SOURCE, syncIssueSource } from "./sync.js";
import type { LinearService, LinearServiceConfig, LinearViewer } from "./types.js";

const DISCONNECTED: LinearConnectionContract = {
  status: "disconnected",
  workspace_name: null,
  workspace_url_key: null,
  user_name: null,
  error_code: null,
  error_message: null,
};

function connected(viewer: LinearViewer): LinearConnectionContract {
  return {
    status: "connected",
    workspace_name: viewer.workspace_name,
    workspace_url_key: viewer.workspace_url_key,
    user_name: viewer.user_name,
    error_code: null,
    error_message: null,
  };
}

function failed(error: unknown): LinearConnectionContract {
  const failure = safeLinearFailure(error);
  return {
    ...DISCONNECTED,
    status: "failed",
    error_code: failure.code,
    error_message: failure.message,
  };
}

export function createLinearService(config: LinearServiceConfig): LinearService {
  const credentials = config.credentials ?? createLinearCredentialStore();
  const idFactory = config.idFactory ?? randomUUID;
  const now = config.now ?? (() => new Date());
  let state: LinearConnectionContract = DISCONNECTED;

  function toContract(row: IssueSourceRow): IssueSourceContract {
    const cursor = getSyncState(config.db, SYNC_SOURCE, SYNC_RESOURCE, row.id);
    return {
      id: row.id,
      source: row.source,
      project_id: row.project_id,
      external_team_id: row.external_team_id,
      external_team_key: row.external_team_key,
      external_team_name: row.external_team_name,
      external_project_id: row.external_project_id,
      external_project_name: row.external_project_name,
      last_synced_at: cursor?.last_synced_at ?? null,
    };
  }

  function requireKey(): string {
    const apiKey = credentials.get();
    if (apiKey === null) throw linearError("linear_not_connected");
    return apiKey;
  }

  /** A revoked key must not leave the surface claiming it is still connected. */
  async function authorized<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof LinearError && error.code === "linear_unauthorized") {
        credentials.clear();
        state = failed(error);
      }
      throw error;
    }
  }

  function resolveSources(sourceId: string | undefined): IssueSourceRow[] {
    if (sourceId === undefined) return listIssueSources(config.db, { source: SYNC_SOURCE });
    const row = getIssueSource(config.db, sourceId);
    if (row === undefined) throw linearError("linear_source_not_found");
    return [row];
  }

  return {
    connection: () => state,

    async connect(apiKey: string) {
      try {
        const viewer = await config.client.viewer(apiKey);
        credentials.set(apiKey);
        state = connected(viewer);
      } catch (error) {
        credentials.clear();
        state = failed(error);
      }
      return state;
    },

    disconnect() {
      credentials.clear();
      state = DISCONNECTED;
      return state;
    },

    // `async` so a missing credential rejects like any other failure; a
    // synchronous throw behind a Promise-typed method would slip past `.catch`.
    async workspace() {
      const apiKey = requireKey();
      return authorized(() => config.client.workspace(apiKey));
    },

    sources: () => listIssueSources(config.db, { source: SYNC_SOURCE }).map(toContract),

    createSource(request: CreateIssueSourceRequest) {
      if (getProject(config.db, request.project_id) === undefined) {
        throw linearError("linear_project_not_found");
      }
      const externalProjectId = request.external_project_id ?? "";
      const existing = findIssueSourceByExternalScope(
        config.db,
        SYNC_SOURCE,
        request.external_team_id,
        externalProjectId,
      );
      if (existing !== undefined) throw linearError("linear_source_already_mapped");

      const id = idFactory();
      insertIssueSource(config.db, {
        id,
        source: SYNC_SOURCE,
        project_id: request.project_id,
        external_team_id: request.external_team_id,
        external_team_key: request.external_team_key,
        external_team_name: request.external_team_name,
        external_project_id: externalProjectId,
        external_project_name: request.external_project_name ?? "",
      });

      const inserted = getIssueSource(config.db, id);
      if (inserted === undefined) throw linearError("linear_request_failed");
      return toContract(inserted);
    },

    async sync(sourceId?: string) {
      const apiKey = requireKey();
      const sources = resolveSources(sourceId);
      const ctx = { db: config.db, client: config.client, idFactory, now };

      return authorized(async () => {
        const results: IssueSourceSyncResult[] = [];
        for (const source of sources) {
          results.push(await syncIssueSource(ctx, source, apiKey));
        }
        return results;
      });
    },
  };
}
