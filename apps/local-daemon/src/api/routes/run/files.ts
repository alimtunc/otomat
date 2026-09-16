import { saveWorktreeFileRequestSchema, type WorktreeFilesResponse } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import { fileContentResponse, refuseFile, saveFileResponse } from "#api/file-content";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import {
  isRepositoryRelative,
  normalizeRepositoryPath,
  worktreeTreeOrNull,
  type WorktreeTree,
} from "#git";

function runTree(deps: ApiDeps, runId: string): WorktreeTree | null {
  const binding = deps.repositories.forRun(runId);
  return binding === null ? null : worktreeTreeOrNull(binding.service, runId);
}

/** Mounted at `/api/runs`: the worktree's own file tree, one file's content at a revision, and the save that presents it back. */
export function createRunFileRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/files", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const tree = runTree(deps, run.id);
    if (tree === null) return refuseFile(c, "workspace_unavailable");
    const response: WorktreeFilesResponse = {
      run_id: run.id,
      editable: tree.worktreePath !== null,
      entries: tree.entries(),
    };
    return c.json(response);
  });

  routes.get("/:id/files/content", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const path = normalizeRepositoryPath(c.req.query("path") ?? "");
    if (!isRepositoryRelative(path)) return refuseFile(c, "path_invalid");
    const tree = runTree(deps, run.id);
    if (tree === null) return refuseFile(c, "workspace_unavailable");
    return fileContentResponse(c, tree, path);
  });

  routes.put(
    "/:id/files/content",
    runGuard(deps.db),
    validateJson(saveWorktreeFileRequestSchema),
    (c) => {
      const run = c.get("run");
      const body = c.req.valid("json");
      const tree = runTree(deps, run.id);
      if (tree === null) return refuseFile(c, "workspace_unavailable");
      if (tree.worktreePath === null) return refuseFile(c, "workspace_read_only");
      return saveFileResponse(c, tree.worktreePath, body);
    },
  );

  return routes;
}
