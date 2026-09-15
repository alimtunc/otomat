import {
  worktreeFileContentSchema,
  worktreeFileSavedSchema,
  worktreeFilesResponseSchema,
  type SaveWorktreeFileRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, putJson, queryString } from "./http.js";

function filesPath(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/files`;
}

export function createRunFilesClient(config: DaemonClientConfig) {
  return {
    async getRunFiles(runId: string) {
      return worktreeFilesResponseSchema.parse(await getJson(config, filesPath(runId)));
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
