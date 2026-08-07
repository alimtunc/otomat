import { modelIdSchema } from "@otomat/domain";
import { Hono, type Context } from "hono";

import {
  describeProviderOptions,
  describeRuntimeModelCatalog,
  isKnownRuntimeId,
  listRuntimeDescriptors,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

import type { ApiDeps } from "../deps.js";
import { readProjects } from "../reads.js";

/** Membership in the descriptor list keeps the gate identical to `/runtimes`: the fake runtime stays hidden in production. */
function listedRuntime(id: string): KnownRuntimeId | null {
  if (!isKnownRuntimeId(id)) return null;
  return listRuntimeDescriptors().some((entry) => entry.id === id) ? id : null;
}

function unknownRuntime(c: Context, id: string) {
  return c.json({ error: "runtime_unknown", message: new UnknownRuntimeError(id).message }, 404);
}

/** Read-only workspace catalog: projects, the runtime registry, and each runtime's model catalog and provider options. */
export function createCatalogRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/projects", (c) => c.json(readProjects(deps.db)));

  routes.get("/runtimes", (c) => c.json(listRuntimeDescriptors()));

  // Probes the installed provider binary, so it stays out of the runtime list every surface polls.
  routes.get("/runtimes/:id/models", (c) => {
    const id = c.req.param("id");
    const runtime = listedRuntime(id);
    return runtime === null ? unknownRuntime(c, id) : c.json(describeRuntimeModelCatalog(runtime));
  });

  // Feature-detected from the installed binary, and model-scoped: Codex publishes reasoning levels per model.
  routes.get("/runtimes/:id/options", (c) => {
    const id = c.req.param("id");
    const runtime = listedRuntime(id);
    if (runtime === null) return unknownRuntime(c, id);
    const requested = c.req.query("model");
    if (requested === undefined) return c.json(describeProviderOptions(runtime, null));
    const model = modelIdSchema.safeParse(requested);
    if (!model.success) {
      return c.json(
        { error: "model_unknown", message: `"${requested}" is not a model identifier` },
        400,
      );
    }
    return c.json(describeProviderOptions(runtime, model.data));
  });

  return routes;
}
