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
    /** Reads the worktrees this host holds; narrowing to a run or a project answers for that scope alone. */
    async listWorkspaces(params: { runId?: string; projectId?: string } = {}) {
      const query = queryString({ run_id: params.runId, project_id: params.projectId });
      return workspaceInventorySchema.parse(await getJson(config, `/api/workspaces${query}`));
    },
    async reconcileWorkspaces() {
      return workspaceReconcileReportSchema.parse(
        await postJson(config, "/api/workspaces/reconcile", {}),
      );
    },
    async cleanupWorkspace(workspaceId: string, force: boolean) {
      return workspaceCleanupResultSchema.parse(
        await postJson(config, `/api/workspaces/${encodeURIComponent(workspaceId)}/cleanup`, {
          force,
        }),
      );
    },
    async workspaceSettings(projectId: string) {
      return workspaceSettingsSchema.parse(
        await getJson(config, `/api/settings/workspaces${queryString({ project_id: projectId })}`),
      );
    },
    async setWorkspaceSettings(projectId: string, settings: WorkspaceSettings) {
      return workspaceSettingsSchema.parse(
        await putJson(
          config,
          `/api/settings/workspaces${queryString({ project_id: projectId })}`,
          settings,
        ),
      );
    },
  };
}
