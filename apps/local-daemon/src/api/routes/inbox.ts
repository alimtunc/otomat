import { upsertInboxMarks } from "@otomat/db";
import { markInboxRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readInbox } from "../inbox.js";

export function createInboxRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readInbox(deps.db)));

  routes.post("/marks", validateJson(markInboxRequestSchema), (c) => {
    upsertInboxMarks(deps.db, c.req.valid("json").marks);
    return c.json(readInbox(deps.db));
  });

  return routes;
}
