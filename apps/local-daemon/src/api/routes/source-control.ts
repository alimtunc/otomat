import {
  changeFilesRequestSchema,
  checkoutTargetSchema,
  commitFilesRequestSchema,
} from "@otomat/domain";
import { Hono, type MiddlewareHandler } from "hono";

import {
  changeCheckoutFiles,
  commitCheckoutFiles,
  isRepositoryRoot,
  sourceControlSnapshot,
  SourceControlError,
  type RepositoryBinding,
} from "#git";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

type SourceControlEnv = { Variables: { checkout: string; binding: RepositoryBinding } };

export function createSourceControlRoutes(deps: ApiDeps) {
  const routes = new Hono<SourceControlEnv>();

  const checkout: MiddlewareHandler<SourceControlEnv> = async (c, next) => {
    const parsed = checkoutTargetSchema.safeParse(c.req.param());
    if (!parsed.success)
      return c.json({ error: "path_invalid", message: "Unknown checkout." }, 400);
    const target = parsed.data;
    const binding =
      target.kind === "run"
        ? deps.repositories.forRun(target.id)
        : deps.repositories.forRepository(target.id);
    const cwd = target.kind === "run" ? binding?.service.get(target.id)?.path : binding?.rootPath;
    if (binding === null || cwd === undefined || !isRepositoryRoot(cwd))
      return c.json(
        { error: "workspace_unavailable", message: "This checkout is unavailable or archived." },
        409,
      );
    c.set("checkout", cwd);
    c.set("binding", binding);
    await next();
  };
  routes.use("/:kind/:id", checkout);
  routes.use("/:kind/:id/commit", checkout);

  routes.get("/:kind/:id", (c) => c.json(sourceControlSnapshot(c.get("checkout")).response));
  routes.post("/:kind/:id", validateJson(changeFilesRequestSchema), (c) => {
    try {
      changeCheckoutFiles(c.get("checkout"), c.req.valid("json"));
    } catch (error) {
      if (!(error instanceof SourceControlError)) throw error;
      return c.json(
        { error: error.code, message: error.message },
        error.code === "path_invalid" ? 400 : 409,
      );
    }
    return c.json({ ok: true });
  });
  routes.post("/:kind/:id/commit", validateJson(commitFilesRequestSchema), (c) => {
    try {
      const request = c.req.valid("json");
      const result =
        c.req.param("kind") === "run"
          ? c.get("binding").service.commitStaged(c.req.param("id"), request)
          : commitCheckoutFiles(c.get("checkout"), request);
      return c.json(result);
    } catch (error) {
      if (!(error instanceof SourceControlError)) throw error;
      return c.json({ error: error.code, message: error.message }, 409);
    }
  });
  return routes;
}
