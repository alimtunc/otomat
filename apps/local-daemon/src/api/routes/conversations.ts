import { Hono } from "hono";

import { streamConversations } from "../conversations-stream.js";
import { readConversations } from "../conversations.js";
import type { ApiDeps } from "../deps.js";

/** Mounted at `/api/conversations`; marks go through `/api/inbox/marks`, which already keys on the projected entry id. */
export function createConversationRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readConversations(deps.db)));
  routes.get("/stream", (c) => streamConversations(c, deps.db));

  return routes;
}
