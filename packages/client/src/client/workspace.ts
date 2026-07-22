import {
  projectContractSchema,
  registerRepositoryResponseSchema,
  repositoryContractSchema,
  type RegisterRepositoryRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

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
    async registerRepository(request: RegisterRepositoryRequest) {
      return registerRepositoryResponseSchema.parse(
        await postJson(config, "/api/repositories", request),
      );
    },
  };
}
