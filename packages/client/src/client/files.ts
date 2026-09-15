import {
  worktreeFileContentSchema,
  worktreeFileSavedSchema,
  worktreeFilesResponseSchema,
  repositoryTreeResponseSchema,
  type SaveWorktreeFileRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, putJson, queryString } from "./http.js";

function filesPath(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/files`;
}

export function createFilesClient(config: DaemonClientConfig) {
  return {
    async getRepositoryTree(repositoryId: string) {
      return repositoryTreeResponseSchema.parse(
        await getJson(config, `/api/repositories/${encodeURIComponent(repositoryId)}/tree`),
      );
    },
    async getRepositoryFile(repositoryId: string, path: string) {
      return worktreeFileContentSchema.parse(
        await getJson(
          config,
          `/api/repositories/${encodeURIComponent(repositoryId)}/tree/content${queryString({ path })}`,
        ),
      );
    },
    async getRunFiles(runId: string) {
      return worktreeFilesResponseSchema.parse(await getJson(config, filesPath(runId)));
    },
    async saveRepositoryFile(repositoryId: string, request: SaveWorktreeFileRequest) {
      return worktreeFileSavedSchema.parse(
        await putJson(
          config,
          `/api/repositories/${encodeURIComponent(repositoryId)}/tree/content`,
          request,
        ),
      );
    },
    async getRunFile(runId: string, path: string) {
      return worktreeFileContentSchema.parse(
        await getJson(config, `${filesPath(runId)}/content${queryString({ path })}`),
      );
    },
    async saveRunFile(runId: string, request: SaveWorktreeFileRequest) {
      return worktreeFileSavedSchema.parse(
        await putJson(config, `${filesPath(runId)}/content`, request),
      );
    },
  };
}
