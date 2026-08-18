import {
  projectContractSchema,
  registerRepositoryResponseSchema,
  repositoryBranchesResponseSchema,
  repositoryContractSchema,
  repositoryFilesResponseSchema,
  workspaceCleanupResultSchema,
  workspaceInventorySchema,
  workspaceReconcileReportSchema,
  workspaceSettingsSchema,
  type RegisterRepositoryRequest,
  type UpdateRepositoryRequest,
  type WorkspaceSettings,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, patchJson, postJson, putJson, queryString } from "./http.js";

export function createWorkspaceClient(config: DaemonClientConfig) {
  return {
    async listProjects() {
      return projectContractSchema.array().parse(await getJson(config, "/api/projects"));
    },
    async listRepositories(params: { projectId?: string } = {}) {
      return repositoryContractSchema
        .array()
        .parse(await getJson(config, `/api/repositories${queryString(params)}`));
    },
    async listRepositoryBranches(repositoryId: string) {
      return repositoryBranchesResponseSchema.parse(
        await getJson(config, `/api/repositories/${encodeURIComponent(repositoryId)}/branches`),
      );
    },
    async searchRepositoryFiles(repositoryId: string, query: string) {
      return repositoryFilesResponseSchema.parse(
        await getJson(
          config,
          `/api/repositories/${encodeURIComponent(repositoryId)}/files${queryString({ q: query })}`,
        ),
      );
    },
    async registerRepository(request: RegisterRepositoryRequest) {
      return registerRepositoryResponseSchema.parse(
        await postJson(config, "/api/repositories", request),
      );
    },
    async updateRepository(repositoryId: string, request: UpdateRepositoryRequest) {
      return repositoryContractSchema.parse(
        await patchJson(config, `/api/repositories/${encodeURIComponent(repositoryId)}`, request),
      );
    },
    async deleteRepository(repositoryId: string) {
      await deleteJson(config, `/api/repositories/${encodeURIComponent(repositoryId)}`);
    },
    /** Reads the worktrees this host holds; narrowing to a run answers for that run's cycle alone. */
    async listWorkspaces(params: { runId?: string } = {}) {
      const query = queryString(params.runId === undefined ? {} : { run_id: params.runId });
      return workspaceInventorySchema.parse(await getJson(config, `/api/workspaces${query}`));
    },
    async reconcileWorkspaces() {
      return workspaceReconcileReportSchema.parse(
        await postJson(config, "/api/workspaces/reconcile", {}),
      );
    },
    async cleanupWorkspace(worktreeId: string) {
      return workspaceCleanupResultSchema.parse(
        await postJson(config, `/api/workspaces/${encodeURIComponent(worktreeId)}/cleanup`, {}),
      );
    },
    async workspaceSettings() {
      return workspaceSettingsSchema.parse(await getJson(config, "/api/settings/workspaces"));
    },
    async setWorkspaceSettings(settings: WorkspaceSettings) {
      return workspaceSettingsSchema.parse(
        await putJson(config, "/api/settings/workspaces", settings),
      );
    },
  };
}
