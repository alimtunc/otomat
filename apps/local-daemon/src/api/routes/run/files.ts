import {
  createWorktreeEntryRequestSchema,
  saveWorktreeFileRequestSchema,
  type WorktreeFilesResponse,
} from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import {
  createEntryResponse,
  fileContentResponse,
  refuseFile,
  saveFileResponse,
} from "#api/file-content";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import {
  isRepositoryRelative,
  checkoutDirectories,
  normalizeRepositoryPath,
  worktreeTreeOrNull,
  type WorktreeTree,
} from "#git";

async function runTree(deps: ApiDeps, runId: string): Promise<WorktreeTree | null> {
  const binding = deps.repositories.forRun(runId);
  return binding === null ? null : worktreeTreeOrNull(binding.service, runId);
}

/** Mounted at `/api/runs`: the worktree's own file tree, one file's content at a revision, and the save that presents it back. */
export function createRunFileRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/files", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    const tree = await runTree(deps, run.id);
    if (tree === null) return refuseFile(c, "workspace_unavailable");
    const response: WorktreeFilesResponse = {
      run_id: run.id,
      editable: tree.worktreePath !== null,
      entries: [
        ...(await tree.entries()),
        ...(tree.worktreePath === null ? [] : await checkoutDirectories(tree.worktreePath)),
      ],
    };
    return c.json(response);
  });

  routes.post(
    "/:id/files",
    runGuard(deps.db),
    validateJson(createWorktreeEntryRequestSchema),
    async (c) => {
      const tree = await runTree(deps, c.get("run").id);
      if (tree === null) return refuseFile(c, "workspace_unavailable");
      if (tree.worktreePath === null) return refuseFile(c, "workspace_read_only");
      return createEntryResponse(c, tree.worktreePath, c.req.valid("json"));
    },
  );

  routes.get("/:id/files/content", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    const path = normalizeRepositoryPath(c.req.query("path") ?? "");
    if (!isRepositoryRelative(path)) return refuseFile(c, "path_invalid");
    const tree = await runTree(deps, run.id);
    if (tree === null) return refuseFile(c, "workspace_unavailable");
    return fileContentResponse(c, tree, path);
  });

  routes.put(
    "/:id/files/content",
    runGuard(deps.db),
    validateJson(saveWorktreeFileRequestSchema),
    async (c) => {
      const run = c.get("run");
      const body = c.req.valid("json");
      const tree = await runTree(deps, run.id);
      if (tree === null) return refuseFile(c, "workspace_unavailable");
      if (tree.worktreePath === null) return refuseFile(c, "workspace_read_only");
      return saveFileResponse(c, tree.worktreePath, body);
    },
  );

  return routes;
}
