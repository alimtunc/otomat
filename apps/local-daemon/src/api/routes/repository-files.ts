import { saveWorktreeFileRequestSchema, type RepositoryTreeResponse } from "@otomat/domain";
import { Hono } from "hono";

import { checkoutTree, isRepositoryRelative, normalizeRepositoryPath } from "#git";

import type { ApiDeps } from "../deps.js";
import { fileContentResponse, refuseFile, saveFileResponse } from "../file-content.js";
import { checkoutGuard, validateJson, type CheckoutEnv } from "../guards.js";

export function createRepositoryFileRoutes(deps: ApiDeps): Hono<CheckoutEnv> {
  const routes = new Hono<CheckoutEnv>();
  routes.use("/:id/tree", checkoutGuard(deps.repositories));
  routes.use("/:id/tree/content", checkoutGuard(deps.repositories));

  routes.get("/:id/tree", (c) => {
    const { binding, cwd } = c.get("checkout");
    const tree = checkoutTree(cwd);
    return c.json({
      repository_id: binding.repositoryId,
      branch: tree.branch,
      entries: tree.entries(),
    } satisfies RepositoryTreeResponse);
  });

  routes.get("/:id/tree/content", (c) => {
    const path = normalizeRepositoryPath(c.req.query("path") ?? "");
    if (!isRepositoryRelative(path)) return refuseFile(c, "path_invalid");
    return fileContentResponse(c, checkoutTree(c.get("checkout").cwd), path);
  });

  routes.put("/:id/tree/content", validateJson(saveWorktreeFileRequestSchema), (c) =>
    saveFileResponse(c, c.get("checkout").cwd, c.req.valid("json")),
  );

  return routes;
}
