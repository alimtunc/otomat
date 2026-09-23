import { changeFilesRequestSchema, commitFilesRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import {
  changeCheckoutFiles,
  commitCheckoutFiles,
  sourceControlSnapshot,
  SourceControlError,
} from "#git";

import type { ApiDeps } from "../deps.js";
import { checkoutGuard, validateJson, type CheckoutEnv } from "../guards.js";

export function createSourceControlRoutes(deps: ApiDeps): Hono<CheckoutEnv> {
  const routes = new Hono<CheckoutEnv>();
  routes.onError((error, c) => {
    if (!(error instanceof SourceControlError)) throw error;
    return c.json(
      { error: error.code, message: error.message },
      error.code === "path_invalid" ? 400 : 409,
    );
  });
  routes.use("/:kind/:id", checkoutGuard(deps.repositories));
  routes.use("/:kind/:id/commit", checkoutGuard(deps.repositories));

  routes.get("/:kind/:id", async (c) =>
    c.json((await sourceControlSnapshot(c.get("checkout").cwd)).response),
  );

  routes.post("/:kind/:id", validateJson(changeFilesRequestSchema), async (c) => {
    await changeCheckoutFiles(c.get("checkout").cwd, c.req.valid("json"));
    return c.json({ ok: true });
  });

  routes.post("/:kind/:id/commit", validateJson(commitFilesRequestSchema), async (c) => {
    const { target, cwd, binding } = c.get("checkout");
    const request = c.req.valid("json");
    return c.json(
      target.kind === "run"
        ? await binding.service.commitStaged(target.id, request)
        : await commitCheckoutFiles(cwd, request),
    );
  });

  return routes;
}
