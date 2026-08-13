import {
  projectContractSchema,
  registerRepositoryResponseSchema,
  repositoryBranchesResponseSchema,
  repositoryContractSchema,
  repositoryFilesResponseSchema,
  type RegisterRepositoryRequest,
  type UpdateRepositoryRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deleteJson, getJson, patchJson, postJson, queryString } from "./http.js";

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
  };
}
