import { saveWorktreeFileRequestSchema, type RepositoryTreeResponse } from "@otomat/domain";
import { Hono } from "hono";

import {
  checkoutTree,
  isRepositoryRelative,
  isRepositoryRoot,
  normalizeRepositoryPath,
} from "#git";

import type { ApiDeps } from "../deps.js";
import { fileContentResponse, refuseFile, saveFileResponse } from "../file-content.js";
import { validateJson } from "../guards.js";

export function createRepositoryFileRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/:id/tree", (c) => {
    const binding = deps.repositories.forRepository(c.req.param("id"));
    if (binding === null) return c.json({ error: "repository_not_found" }, 404);
    if (!isRepositoryRoot(binding.rootPath)) return refuseFile(c, "workspace_unavailable");
    const tree = checkoutTree(binding.rootPath);
    return c.json({
      repository_id: binding.repositoryId,
      branch: tree.branch,
      entries: tree.entries(),
    } satisfies RepositoryTreeResponse);
  });

  routes.get("/:id/tree/content", (c) => {
    const path = normalizeRepositoryPath(c.req.query("path") ?? "");
    if (!isRepositoryRelative(path)) return refuseFile(c, "path_invalid");
    const binding = deps.repositories.forRepository(c.req.param("id"));
    if (binding === null) return c.json({ error: "repository_not_found" }, 404);
    if (!isRepositoryRoot(binding.rootPath)) return refuseFile(c, "workspace_unavailable");
    return fileContentResponse(c, checkoutTree(binding.rootPath), path);
  });

  routes.put("/:id/tree/content", validateJson(saveWorktreeFileRequestSchema), (c) => {
    const binding = deps.repositories.forRepository(c.req.param("id"));
    if (binding === null) return c.json({ error: "repository_not_found" }, 404);
    if (!isRepositoryRoot(binding.rootPath)) return refuseFile(c, "workspace_unavailable");
    return saveFileResponse(c, binding.rootPath, c.req.valid("json"));
  });

  return routes;
}
