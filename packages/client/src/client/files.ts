import {
  worktreeFileContentSchema,
  worktreeFileSavedSchema,
  worktreeFilesResponseSchema,
  repositoryTreeResponseSchema,
  type CheckoutTarget,
  type SaveWorktreeFileRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, putJson, queryString } from "./http.js";

function filesPath(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/files`;
}

function treePath(repositoryId: string): string {
  return `/api/repositories/${encodeURIComponent(repositoryId)}/tree`;
}

function contentPath(target: CheckoutTarget): string {
  return `${target.kind === "run" ? filesPath(target.id) : treePath(target.id)}/content`;
}

export function createFilesClient(config: DaemonClientConfig) {
  return {
    async getRepositoryTree(repositoryId: string) {
      return repositoryTreeResponseSchema.parse(await getJson(config, treePath(repositoryId)));
    },
    async getRunFiles(runId: string) {
      return worktreeFilesResponseSchema.parse(await getJson(config, filesPath(runId)));
    },
    async getCheckoutFile(target: CheckoutTarget, path: string) {
      return worktreeFileContentSchema.parse(
        await getJson(config, `${contentPath(target)}${queryString({ path })}`),
      );
    },
    async saveCheckoutFile(target: CheckoutTarget, request: SaveWorktreeFileRequest) {
      return worktreeFileSavedSchema.parse(await putJson(config, contentPath(target), request));
    },
  };
}
